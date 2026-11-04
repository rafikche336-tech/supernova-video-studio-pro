import { NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * Small helpers shared by the route handlers.
 */

/**
 * Rejects cross-site state-changing requests.
 *
 * Browsers always send `Origin` on cross-origin POSTs; non-browser clients
 * (curl, the integration suite) send none and carry no cookies, so they are
 * allowed through. This is defence in depth on top of SameSite cookies.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const host = request.headers.get('host');
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbiddenCrossOrigin(): NextResponse {
  return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
}

export function unauthorised(): NextResponse {
  return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
}

export function noStore<T extends Record<string, unknown>>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function logRouteError(
  route: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logger.error('route failed', {
    route,
    message: error instanceof Error ? error.message : String(error),
    ...context,
  });
}
