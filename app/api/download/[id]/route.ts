import { recordEvent } from '@/db/events';
import { getRenderById } from '@/db/renders';
import { serveVideo } from '@/lib/media/serve';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/download/:id — download a finished clip.
 *
 * Streams from local storage (or proxies the provider URL if storing failed) with
 * `Content-Disposition: attachment`, so the browser saves it under a friendly
 * name — no client-side fetch, no CORS, no popup. Ownership, sharing and event
 * logging all happen here on the server.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: 'Clip not found.' }, { status: 404 });
  }

  const record = getRenderById(id);
  if (!record || record.status !== 'succeeded' || !record.videoUrl) {
    return Response.json({ error: 'Clip not found.' }, { status: 404 });
  }

  const viewer = await getSessionUser();
  const isOwner = viewer?.id === record.userId;
  const isShared = record.shareSlug !== null;

  // Not-yours and not-shared is indistinguishable from "does not exist".
  if (!isOwner && !isShared) {
    return Response.json({ error: 'Clip not found.' }, { status: 404 });
  }

  if (isOwner && viewer) {
    recordEvent({ type: 'download', userId: viewer.id, renderId: record.id });
  }

  return serveVideo(record.id, record.sourceUrl, request, {
    downloadFilename: `supernova-${record.engine}-${record.id.slice(0, 8)}.mp4`,
    bundledUrl: record.videoUrl,
  });
}
