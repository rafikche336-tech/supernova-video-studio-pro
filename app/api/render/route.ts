import { NextResponse } from 'next/server';
import { MAX_PROMPT_LENGTH } from '@/lib/config';
import { getEnv } from '@/lib/env';
import { ENGINE_IDS } from '@/lib/engines/registry';
import {
  forbiddenCrossOrigin,
  isSameOrigin,
  logRouteError,
  noStore,
  unauthorised,
} from '@/lib/http';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { getProviderResolution } from '@/lib/render';
import { formatIssues, renderRequestSchema } from '@/lib/render/schema';
import { toRenderJob } from '@/lib/render/serialize';
import { startRender } from '@/lib/render/service';
import { RenderProviderError } from '@/lib/render/types';
import { requireApiUser } from '@/lib/session';

export const runtime = 'nodejs';

/** Absolute ceiling for a request body (a prompt is capped at 400 chars). */
const MAX_REQUEST_BYTES = 8 * 1024;

function clientKey(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const firstHop = forwarded?.split(',')[0]?.trim();
  if (firstHop) return `ip:${firstHop}`;

  return `ip:${request.headers.get('x-real-ip')?.trim() || 'unknown'}`;
}

/**
 * POST /api/render — create a render job for the signed-in user.
 *
 * @returns 202 `{ job, mode }` · 400 bad JSON · 401 anonymous · 403 cross-origin
 *          413 too large · 422 invalid · 429 rate limited · 501 live not configured
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();

  const user = await requireApiUser();
  if (!user) return unauthorised();

  const env = getEnv();
  const limit = checkRateLimit(clientKey(request, user.id), {
    capacity: env.RATE_LIMIT_CAPACITY,
    refillPerSecond: env.RATE_LIMIT_REFILL_PER_SECOND,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many renders. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'prompt' in payload &&
    typeof payload.prompt === 'string' &&
    payload.prompt.length > MAX_PROMPT_LENGTH
  ) {
    return NextResponse.json(
      { error: `Prompt must be at most ${MAX_PROMPT_LENGTH} characters.` },
      { status: 413 },
    );
  }

  const parsed = renderRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', issues: formatIssues(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const resolution = getProviderResolution();
    const record = await startRender({
      userId: user.id,
      prompt: parsed.data.prompt,
      engine: parsed.data.engine,
    });

    const mode = record.provider === 'demo' ? 'demo' : 'live';

    // The router silently falls back to the demo renderer when the live provider
    // rejects a job. Say so in the response instead of letting the client believe
    // it got model output.
    const fellBack = record.provider === 'demo' && resolution.activeId !== 'demo';

    logger.info('render job created', {
      jobId: record.id,
      engine: record.engine,
      provider: record.provider,
      userId: user.id,
    });

    return noStore(
      {
        job: toRenderJob(record),
        mode,
        provider: record.provider,
        ...(fellBack
          ? {
              fallback: true,
              notice:
                'The live provider rejected this job, so it was rendered as a demo clip. Check the server logs for the provider error.',
            }
          : {}),
      },
      202,
    );
  } catch (error) {
    if (error instanceof RenderProviderError) {
      logger.warn('render provider unavailable', { code: error.code, message: error.message });
      return noStore({ error: error.message, code: error.code }, error.status);
    }

    logRouteError('POST /api/render', error, { userId: user.id });
    return NextResponse.json({ error: 'Render failed.' }, { status: 500 });
  }
}

/**
 * GET /api/render — capabilities, health and which backend is live.
 *
 * Cached briefly (not for an hour): the provider can be switched by changing the
 * environment, and an operator checking this endpoint expects the truth.
 */
export async function GET(): Promise<NextResponse> {
  const env = getEnv();
  const resolution = getProviderResolution();
  const live = resolution.activeId !== 'demo';

  return NextResponse.json(
    {
      status: 'ok',
      mode: live ? 'live' : 'demo',
      maxPromptLength: MAX_PROMPT_LENGTH,
      engines: ENGINE_IDS,
      requiresAuth: true,
      provider: {
        id: resolution.activeId,
        model: resolution.model ?? null,
        live,
        requested: resolution.requested,
        notice: resolution.notice ?? null,
        fallback: 'demo',
        configured: {
          fal: Boolean(env.FAL_KEY),
          replicate: Boolean(env.REPLICATE_API_TOKEN),
        },
      },
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
