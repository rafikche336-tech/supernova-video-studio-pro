import { NextResponse } from 'next/server';
import { logRouteError, noStore, unauthorised } from '@/lib/http';
import { toRenderJob } from '@/lib/render/serialize';
import { RenderProviderError } from '@/lib/render/types';
import { pollRender } from '@/lib/render/service';
import { requireApiUser } from '@/lib/session';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/render/:id — poll one of *your* jobs.
 *
 * Scoped by owner: another user's job id returns 404, not 403, so ids cannot be
 * probed for existence.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  const user = await requireApiUser();
  if (!user) return unauthorised();

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  try {
    const record = await pollRender(user.id, id);
    if (!record) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    return noStore({ job: toRenderJob(record) });
  } catch (error) {
    if (error instanceof RenderProviderError) {
      // Provider errors are already written for humans and redacted; the service
      // normally absorbs them (grace window), so this is the last line of defence.
      logRouteError('GET /api/render/[id]', error, { jobId: id, userId: user.id });
      return noStore({ error: error.message }, error.status);
    }

    logRouteError('GET /api/render/[id]', error, { jobId: id, userId: user.id });
    return NextResponse.json({ error: 'Job lookup failed.' }, { status: 500 });
  }
}
