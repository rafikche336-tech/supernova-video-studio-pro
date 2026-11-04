import { redirect } from 'next/navigation';
import { getUserById, type UserRecord } from '@/db/users';
import { auth } from './auth';

/**
 * Server-side session helpers.
 *
 * `auth()` gives us a JWT; the *user record* is re-read from SQLite on every
 * request so a deleted account cannot keep browsing with a stale token.
 */

export async function getSessionUser(): Promise<UserRecord | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return getUserById(id);
}

/** Page helper — redirects to /login and remembers where the visitor was going. */
export async function requireUser(nextPath = '/studio'): Promise<UserRecord> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

/** Route-handler helper — returns null instead of redirecting. */
export async function requireApiUser(): Promise<UserRecord | null> {
  return getSessionUser();
}
