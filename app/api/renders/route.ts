import { NextResponse } from 'next/server';
import { listRecentForUser } from '@/db/renders';
import { noStore, unauthorised } from '@/lib/http';
import { toRenderJob } from '@/lib/render/serialize';
import { requireApiUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * GET /api/renders?limit=6 — the signed-in user's most recent renders.
 * Used by the studio to refresh its history rail after a job completes.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) return unauthorised();

  const requested = Number(new URL(request.url).searchParams.get('limit') ?? '6');
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 24) : 6;

  return noStore({ renders: listRecentForUser(user.id, limit).map(toRenderJob) });
}
