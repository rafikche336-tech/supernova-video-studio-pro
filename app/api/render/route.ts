import { NextResponse } from 'next/server';
import { MAX_PROMPT_LENGTH } from '@/lib/config';
import { getEnv } from '@/lib/env';
import { ENGINE_IDS } from '@/lib/engines/registry';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRenderProvider } from '@/lib/render';
import { formatIssues, renderRequestSchema } from '@/lib/render/schema';
import { RenderProviderError } from '@/lib/render/types';

export const runtime = 'nodejs';

/**
 * Absolute ceiling for a request body. A prompt is capped at 400 characters, so
 * 8 KB is already generous — anything larger is a client bug or an attack. v1
 * had no limit and happily parsed (and echoed) 1 MB payloads.
 */
const MAX_REQUEST_BYTES = 8 * 1024;

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const firstHop = forwarded?.split(',')[0]?.trim();
  if (firstHop) return firstHop;

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * POST /api/render — create a render job.
 *
 * @returns 202 `{ job, mode }` when accepted.
 * @returns 400 invalid JSON body.
 * @returns 413 body or prompt too large.
 * @returns 422 schema validation failed.
 * @returns 429 rate limited (see `Retry-After`).
 * @returns 501 live provider requested but not configured.
 * @returns 500 unexpected server error.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = getEnv();

  const limit = checkRateLimit(clientKey(request), {
    capacity: env.RATE_LIMIT_CAPACITY,
    refillPerSecond: env.RATE_LIMIT_REFILL_PER_SECOND,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
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

  // Reject oversized prompts before schema work so the reason is unambiguous.
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
    const provider = getRenderProvider();
    const job = await provider.create(parsed.data);

    logger.info('render job created', { jobId: job.id, engine: job.engine, mode: provider.mode });

    return NextResponse.json(
      { job, mode: provider.mode },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof RenderProviderError) {
      logger.warn('render provider unavailable', { code: error.code, message: error.message });
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    logger.error('render job failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Render failed.' }, { status: 500 });
  }
}

/**
 * GET /api/render — capability discovery / health check.
 *
 * Cacheable at the edge: it only reports static configuration.
 */
export async function GET(): Promise<NextResponse> {
  const env = getEnv();

  return NextResponse.json(
    {
      status: 'ok',
      mode: env.RENDER_PROVIDER,
      maxPromptLength: MAX_PROMPT_LENGTH,
      engines: ENGINE_IDS,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
