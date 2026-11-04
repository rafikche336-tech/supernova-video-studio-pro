import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { githubEnabled } from '@/lib/auth';
import { safeNextPath } from '@/lib/nav';
import { getSessionUser } from '@/lib/session';
import { signInAsGuest, signInWithGitHub } from './actions';
import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in with GitHub, or continue as a guest to try the studio.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getSessionUser();

  if (user) redirect(next);

  return (
    <>
      <SiteHeader />
      <main className={`pageShell withDock ${styles.page}`}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Account</p>
          <h1 className={styles.title}>Sign in to render</h1>
          <p className={styles.lead}>
            Renders, downloads and analytics are stored per account. Sign in with GitHub to keep
            your library, or continue as a guest to try it out — guest libraries are disposable.
          </p>

          <form action={signInWithGitHub} className={styles.form}>
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className={`btn btnPrimary ${styles.github}`}
              disabled={!githubEnabled}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.githubIcon}>
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2.01-.27c.68 0 1.36.09 2.01.27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                />
              </svg>
              Continue with GitHub
            </button>
            {githubEnabled ? null : (
              <p className={styles.hint}>
                GitHub OAuth is not configured on this deployment — set <code>AUTH_GITHUB_ID</code>{' '}
                and <code>AUTH_GITHUB_SECRET</code> to enable it.
              </p>
            )}
          </form>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <form action={signInAsGuest} className={styles.form}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className={`btn ${styles.guest}`}>
              Continue as guest
            </button>
          </form>

          <ul className={styles.perks}>
            <li>Renders across 8 engine profiles, saved to your history</li>
            <li>Every clip saved to your history with a real download</li>
            <li>Share links with per-render previews</li>
            <li>Personal analytics dashboard</li>
          </ul>

          <p className={styles.legal}>
            Renders call a real text-to-video model when this deployment has a provider key, and
            fall back to a bundled demo clip (clearly labelled) when it does not. Accounts, history,
            downloads and analytics are always real and stored in this deployment&apos;s database.
          </p>
        </div>
      </main>
    </>
  );
}
