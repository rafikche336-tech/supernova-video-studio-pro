import { getRenderById } from '@/db/renders';
import { getSessionUser } from '@/lib/session';
import { serveVideo } from '@/lib/media/serve';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/media/:id — play a render.
 *
 * Same access rules as downloads (owner, or anyone once shared), but tuned for a
 * `<video>` element: inline disposition, `Range` support so seeking works, and a
 * shorter cache. It exists because AI-generated clips live on provider URLs that
 * expire — serving them from this origin keeps the CSP at `media-src 'self'` and
 * means one URL works forever.
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

  if (!isOwner && !isShared) {
    return Response.json({ error: 'Clip not found.' }, { status: 404 });
  }

  return serveVideo(record.id, record.sourceUrl, request, { bundledUrl: record.videoUrl });
}
