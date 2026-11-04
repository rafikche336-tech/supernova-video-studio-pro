import type { RenderRecord } from '@/db/renders';
import { getClip } from '@/lib/engines/registry';
import type { RenderJob } from './types';

/**
 * Maps a database row onto the public job shape used by the API and the UI.
 *
 * Live renders store a provider URL on the row until the download lands, so any
 * absolute URL is rewritten to the same-origin media route. That keeps playback
 * inside the CSP (`media-src 'self'`) and survives provider links expiring.
 */
export function toRenderJob(record: RenderRecord): RenderJob {
  const videoUrl = record.videoUrl
    ? record.videoUrl.startsWith('http')
      ? `/api/media/${record.id}`
      : record.videoUrl
    : undefined;

  const clipAlt = record.clip ? getClip(record.clip).alt : undefined;

  return {
    id: record.id,
    engine: record.engine,
    prompt: record.prompt,
    status: record.status,
    progress: record.progress,
    ...(record.clip ? { clip: record.clip } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(record.posterUrl ? { posterUrl: record.posterUrl } : {}),
    ...(clipAlt ? { videoAlt: clipAlt } : {}),
    ...(record.error ? { error: record.error } : {}),
    ...(record.provider ? { provider: record.provider } : {}),
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}
