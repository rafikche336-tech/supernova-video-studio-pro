import Link from 'next/link';
import type { UserRecord } from '@/db/users';
import { getSessionUser } from '@/lib/session';
import { signOutAction } from '@/app/login/actions';
import styles from './SiteHeader.module.css';

export type NavKey = 'studio' | 'history' | 'dashboard';

const NAV: { key: NavKey; href: string; label: string; icon: string }[] = [
  { key: 'studio', href: '/studio', label: 'Studio', icon: 'M4 5h16v14H4z M9 9l6 3-6 3z' },
  { key: 'history', href: '/history', label: 'History', icon: 'M12 8v4l3 2 M12 3a9 9 0 1 0 9 9' },
  {
    key: 'dashboard',
    href: '/dashboard',
    label: 'Analytics',
    icon: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  },
];

function Avatar({ user }: { user: UserRecord }) {
  const initial = user.name.trim().charAt(0).toUpperCase() || 'S';
  return (
    <span className={styles.avatar} aria-hidden="true">
      {initial}
    </span>
  );
}

/**
 * Global header.
 *
 * Deliberately a server component: the session and the user record are read on
 * the server, so the client ships no auth state and there is no signed-out flash.
 * On phones the same links reappear as a thumb-reachable bottom dock.
 */
export async function SiteHeader({ active }: { active?: NavKey }) {
  const user = await getSessionUser();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link href="/" className={styles.brand} aria-label="Supernova Video Studio Pro — home">
            <span className={styles.brandMark} aria-hidden="true" />
            SUPERNOVA<span className={styles.brandDim}>STUDIO</span>
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={styles.navLink}
                aria-current={active === item.key ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.account}>
            {user ? (
              <div className={styles.userBlock}>
                <Avatar user={user} />
                <span className={styles.userName}>{user.name.split(' ')[0]}</span>
                {user.provider === 'guest' ? <span className={styles.guestTag}>guest</span> : null}
                <form action={signOutAction}>
                  <button type="submit" className={styles.signOut}>
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/login" className={`btn btnSmall ${styles.signIn}`}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className={styles.dock} aria-label="Primary (mobile)">
        <Link
          href="/"
          className={styles.dockItem}
          aria-current={active === undefined ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
          Home
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={styles.dockItem}
            aria-current={active === item.key ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
