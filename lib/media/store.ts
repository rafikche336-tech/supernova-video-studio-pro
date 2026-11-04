import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getEnv } from '@/lib/env';
import { RenderProviderError } from '@/lib/render/types';

/**
 * Local storage for AI-generated video.
 *
 * Providers hand back **temporary** URLs (Replicate deletes files after about an
 * hour; fal media expires too), so a finished job is downloaded once and kept on
 * disk. That also keeps the CSP at `media-src 'self'` and makes downloads and
 * share pages work without CORS or hot-linking.
 *
 * The directory must be on a persistent volume in production — same constraint
 * as the SQLite database.
 */

const DOWNLOAD_TIMEOUT_MS = 180_000;

const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
]);

export function mediaDir(): string {
  const configured = getEnv().MEDIA_DIR;
  return isAbsolute(configured)
    ? configured
    : join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function videoPath(renderId: string): string {
  return join(mediaDir(), `${renderId}.mp4`);
}

/**
 * Only `http(s)` URLs, and no link-local/metadata addresses.
 *
 * The URL comes from a provider response rather than from a user, but a
 * compromised or misconfigured provider should not be able to make the server
 * fetch cloud metadata. Loopback is allowed only when the operator has pointed a
 * provider at a custom base URL (the local stub used by the integration suite).
 */
export function isSafeRemoteUrl(value: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const host = parsed.hostname.toLowerCase();
  if (host.startsWith('169.254.')) return false;

  const allowLoopback = Boolean(getEnv().FAL_API_BASE_URL || getEnv().REPLICATE_API_BASE_URL);

  if (host === '127.0.0.1' || host === '::1') {
    return allowLoopback;
  }

  return !BLOCKED_HOSTS.has(host);
}

export async function hasVideo(renderId: string): Promise<boolean> {
  try {
    const info = await stat(videoPath(renderId));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

export async function videoSize(renderId: string): Promise<number | null> {
  try {
    return (await stat(videoPath(renderId))).size;
  } catch {
    return null;
  }
}

export async function deleteVideo(renderId: string): Promise<void> {
  await unlink(videoPath(renderId)).catch(() => undefined);
}

export interface DownloadResult {
  readonly bytes: number;
  readonly path: string;
}

/** Downloads a provider video to local storage. Safe to call twice. */
export async function downloadVideo(renderId: string, url: string): Promise<DownloadResult> {
  if (!isSafeRemoteUrl(url)) {
    throw new RenderProviderError(
      'provider-failed',
      'The video provider returned an untrusted download URL.',
      502,
    );
  }

  const maxBytes = getEnv().VIDEO_MAX_BYTES;

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    throw new RenderProviderError(
      'provider-failed',
      `Could not download the finished video (${error instanceof Error ? error.message : 'network error'}).`,
      502,
    );
  }

  if (!response.ok || !response.body) {
    throw new RenderProviderError(
      'provider-failed',
      `The provider's video download failed (HTTP ${response.status}).`,
      502,
    );
  }

  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RenderProviderError(
      'provider-failed',
      'The generated video is too large to store.',
      502,
    );
  }

  const target = videoPath(renderId);
  const temporary = `${target}.part`;

  await mkdir(dirname(target), { recursive: true });

  let written = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length;
      if (written > maxBytes) {
        callback(new Error('Generated video exceeded VIDEO_MAX_BYTES'));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      counter,
      createWriteStream(temporary),
    );
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw new RenderProviderError(
      'provider-failed',
      `Could not store the finished video (${error instanceof Error ? error.message : 'write error'}).`,
      502,
    );
  }

  return { bytes: written, path: target };
}
