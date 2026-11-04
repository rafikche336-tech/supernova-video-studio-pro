import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getRenderProvider } from '@/lib/render';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/render/:id — poll a render job.
 *
 * @returns 200 `{ job }` for known, unexpired jobs.
 * @returns 404 for unknown, expired or malformed ids.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  try {
    const job = await getRenderProvider().get(id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    return NextResponse.json({ job }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('job lookup failed', {
      jobId: id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Job lookup failed.' }, { status: 500 });
  }
}
