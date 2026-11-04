import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { videoPath } from './store';

/**
 * Serves a render's video: the local copy when we have it, otherwise the
 * provider's URL proxied through this origin.
 *
 * Range requests are honoured for local files (video seeking needs them). A
 * proxied response is passed through as-is — the provider usually supports
 * ranges too, and we forward the client's `Range` header where possible.
 */

export interface ServeOptions {
  /** Set to force a download (adds `Content-Disposition: attachment`). */
  readonly downloadFilename?: string;
  /**
   * The row's `videoUrl`. Demo renders point at a bundled `/media/<name>.mp4`
   * in `public/`, which has no copy in the media directory — stream it from
   * there rather than 404ing the download button.
   */
  readonly bundledUrl?: string | null;
}

/** `/media/neon.mp4` → `public/media/neon.mp4`, or null when it is not one. */
function bundledPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/media/')) return null;

  const name = value.slice('/media/'.length);
  if (!/^[a-z0-9-]+\.mp4$/i.test(name)) return null;

  return join(/* turbopackIgnore: true */ process.cwd(), 'public', 'media', name);
}

/** Streams a file with Range support. Returns null when the file is unusable. */
async function streamFile(
  path: string,
  request: Request,
  attachment: string | undefined,
  cacheControl: string,
): Promise<Response | null> {
  let size: number;

  try {
    const info = await stat(path);
    if (!info.isFile() || info.size === 0) return null;
    size = info.size;
  } catch {
    return null;
  }

  const headers = new Headers({
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
  });

  if (attachment) {
    headers.set('content-disposition', `attachment; filename="${attachment}"`);
  }

  const range = parseRange(request.headers.get('range'), size);

  if (range) {
    const { start, end } = range;
    headers.set('content-range', `bytes ${start}-${end}/${size}`);
    headers.set('content-length', String(end - start + 1));

    const stream = createReadStream(path, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers,
    });
  }

  headers.set('content-length', String(size));
  const stream = createReadStream(path);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers,
  });
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  const start = rawStart ? Number(rawStart) : 0;
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null;
  }

  return { start, end };
}

export async function serveVideo(
  renderId: string,
  sourceUrl: string | null,
  request: Request,
  options: ServeOptions = {},
): Promise<Response> {
  const path = videoPath(renderId);
  const attachment = options.downloadFilename;

  // 1. Local copy — full Range support.
  const local = await streamFile(
    path,
    request,
    attachment,
    attachment ? 'private, max-age=0, must-revalidate' : 'private, max-age=3600',
  );
  if (local) return local;

  // 2. Bundled demo clip shipped in `public/`.
  const bundled = bundledPath(options.bundledUrl);
  if (bundled) {
    const response = await streamFile(
      bundled,
      request,
      attachment,
      attachment ? 'private, max-age=0, must-revalidate' : 'public, max-age=3600',
    );
    if (response) return response;
  }

  // 3. Proxy the provider's file (it may still be warm, or storage may have failed).
  if (sourceUrl) {
    try {
      const upstream = await fetch(sourceUrl, {
        headers: request.headers.get('range')
          ? { range: request.headers.get('range') as string }
          : {},
        signal: AbortSignal.timeout(60_000),
        cache: 'no-store',
        redirect: 'follow',
      });

      if (upstream.ok && upstream.body) {
        const headers = new Headers({
          'content-type': upstream.headers.get('content-type') ?? 'video/mp4',
          'cache-control': 'private, max-age=600',
          'x-content-type-options': 'nosniff',
          'accept-ranges': upstream.headers.get('accept-ranges') ?? 'none',
        });

        const length = upstream.headers.get('content-length');
        const contentRange = upstream.headers.get('content-range');
        if (length) headers.set('content-length', length);
        if (contentRange) headers.set('content-range', contentRange);
        if (attachment) {
          headers.set('content-disposition', `attachment; filename="${attachment}"`);
        }

        return new Response(upstream.body as unknown as ReadableStream, {
          status: upstream.status === 206 ? 206 : 200,
          headers,
        });
      }
    } catch {
      // Fall through to 404.
    }
  }

  return Response.json({ error: 'Clip not found.' }, { status: 404 });
}
