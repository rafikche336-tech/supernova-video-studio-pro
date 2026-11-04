/**
 * Helpers shared by the live providers.
 */

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.gif'];

function isVideoUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  const withoutQuery = value.split('?')[0]?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.some((extension) => withoutQuery.endsWith(extension));
}

/**
 * Finds the first video URL anywhere in a provider response.
 *
 * Every provider nests its output differently (`{video:{url}}`,
 * `{video_url}`, `{output:[url]}`, `{output:"url"}`, `{videos:[{url}]}`) and the
 * shapes change as models are updated. Rather than hard-coding one schema per
 * model, walk the payload. Keys named `video` are visited first so an mp4 wins
 * over a stray thumbnail.
 */
export function extractVideoUrl(payload: unknown, depth = 0): string | null {
  if (payload === null || payload === undefined || depth > 6) return null;

  if (typeof payload === 'string') {
    return isVideoUrl(payload) ? payload : null;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const found = extractVideoUrl(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const priorityKeys = Object.keys(record).sort((a, b) => {
    const rank = (key: string) => (key === 'video' ? 0 : key === 'url' ? 1 : 2);
    return rank(a) - rank(b);
  });

  for (const key of priorityKeys) {
    const found = extractVideoUrl(record[key], depth + 1);
    if (found) return found;
  }

  return null;
}

/**
 * Progress for providers that only expose coarse states.
 *
 * Long jobs should not sit at 50% for ninety seconds, so the number ramps with
 * elapsed time against an expected duration: quick at first, asymptotic to
 * `max` so it never claims completion early.
 */
export function rampProgress(elapsedMs: number, expectedMs: number, min = 12, max = 92): number {
  const ratio = Math.min(Math.max(elapsedMs / Math.max(expectedMs, 1), 0), 1);
  const eased = 1 - (1 - ratio) ** 2;
  return Math.round(min + (max - min) * eased);
}

/** `fal:abc` → `abc`; tolerant of ids that never got a prefix. */
export function stripProviderPrefix(provider: string, value: string): string {
  const prefix = `${provider}:`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
