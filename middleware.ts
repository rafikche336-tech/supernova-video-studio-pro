export const runtime = 'nodejs';

import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { getRenderBySlug } from '@/db/renders';
import { authConfig } from '@/lib/auth.config';
import { isShareSlug } from '@/lib/share';

/**
 * Edge-of-app routing rules.
 *
 * 1. **Account area** (`/studio`, `/history`, `/dashboard`) — redirect anonymous
 *    visitors to the login page. A redirect thrown inside a streaming server
 *    component arrives after the shell has been flushed and can only be applied
 *    client-side, so the check lives here and produces a real `307`. The pages
 *    still call `requireUser()` themselves: middleware is defence in depth.
 * 2. **Share pages** (`/s/:slug`) — a missing slug must be an HTTP `404`. Inside
 *    a dynamic segment `notFound()` renders correctly for humans but the status
 *    stays `200`, which is wrong for link unfurlers, so we answer here instead.
 *
 * Runs on the Node runtime because it reads the SQLite database. Only
 * `lib/auth.config` (no database) is needed for the session check itself.
 */
const { auth } = NextAuth(authConfig);

const SHARE_PREFIX = '/s/';

function notFoundPage(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Clip not found · Supernova Video Studio</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; background:#050507;
         color:#fff; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; text-align:center; padding:24px; }
  h1 { font-size:1.6rem; margin:0 0 8px; letter-spacing:-0.02em; }
  p { color:rgba(255,255,255,0.6); max-width:42ch; line-height:1.6; margin:0 auto 22px; }
  a { display:inline-flex; align-items:center; min-height:44px; padding:0 18px; margin:0 5px;
      border-radius:999px; border:1px solid rgba(212,175,55,0.4); background:rgba(212,175,55,0.16);
      color:#f0cf6b; text-decoration:none; font-weight:600; font-size:0.9rem; }
  a.secondary { border-color:rgba(255,255,255,0.12); background:transparent; color:rgba(255,255,255,0.75); }
</style></head>
<body><main>
  <h1>Clip not found</h1>
  <p>This share link no longer points at a finished render. It may have been deleted, or the link may be mistyped.</p>
  <a href="/studio">Open the studio</a>
  <a class="secondary" href="/">Back home</a>
</main></body></html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

export default auth((request: NextRequest & { auth: unknown }) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(SHARE_PREFIX)) {
    const slug = pathname.slice(SHARE_PREFIX.length).split('/')[0] ?? '';
    const render = isShareSlug(slug) ? getRenderBySlug(slug) : null;

    if (!render || render.status !== 'succeeded') {
      return notFoundPage();
    }

    return NextResponse.next();
  }

  if (request.auth && (request.auth as { user?: unknown }).user) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.nextUrl.origin);
  loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
});

/** Must be a literal: Turbopack rejects computed matchers. */
export const config = {
  matcher: ['/studio', '/history', '/dashboard', '/s/:slug*'],
};
