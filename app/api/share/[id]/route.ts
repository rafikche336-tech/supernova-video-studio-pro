import { NextResponse } from 'next/server';
import { recordEvent } from '@/db/events';
import { getRenderForUser, setShareSlug } from '@/db/renders';
import { getEnv } from '@/lib/env';
import {
  forbiddenCrossOrigin,
  isSameOrigin,
  logRouteError,
  noStore,
  unauthorised,
} from '@/lib/http';
import { generateShareSlug, shareUrl } from '@/lib/share';
import { requireApiUser } from '@/lib/session';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SLUG_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code: unknown }).code).startsWith('SQLITE_CONSTRAINT')
  );
}

/**
 * POST /api/share/:id — make a finished render publicly viewable.
 *
 * Returns the existing slug if the render was already shared (idempotent), so
 * tapping "Share" twice does not burn a new link.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();

  const user = await requireApiUser();
  if (!user) return unauthorised();

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Clip not found.' }, { status: 404 });
  }

  const record = getRenderForUser(id, user.id);
  if (!record) {
    return NextResponse.json({ error: 'Clip not found.' }, { status: 404 });
  }

  if (record.status !== 'succeeded' || !record.videoUrl) {
    return NextResponse.json({ error: 'This render is not ready yet.' }, { status: 409 });
  }

  let slug = record.shareSlug;

  try {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !slug; attempt += 1) {
      const candidate = generateShareSlug();
      try {
        setShareSlug(record.id, candidate);
        slug = candidate;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    if (!slug) {
      return NextResponse.json({ error: 'Could not create a share link.' }, { status: 500 });
    }

    recordEvent({ type: 'share', userId: user.id, renderId: record.id, metadata: { slug } });

    // Prefer the configured public origin: behind a proxy the request URL is the
    // internal one (0.0.0.0:3000), which would produce unusable share links.
    const origin = getEnv().NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    return noStore({ slug, url: shareUrl(origin, slug) });
  } catch (error) {
    logRouteError('POST /api/share/[id]', error, { renderId: id, userId: user.id });
    return NextResponse.json({ error: 'Could not create a share link.' }, { status: 500 });
  }
}
