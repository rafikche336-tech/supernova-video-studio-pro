import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import { recordEvent } from '@/db/events';
import { createGuestUser, upsertUser } from '@/db/users';
import { authConfig } from './auth.config';
import { getEnv } from './env';
import { logger } from './logger';

/**
 * Auth.js v5 (NextAuth) — Node half of the configuration.
 *
 * Two ways in:
 *  - **GitHub OAuth** — enabled only when AUTH_GITHUB_ID/SECRET are present, so
 *    the app still runs (and CI still passes) without OAuth credentials.
 *  - **Guest** — a credentials provider that mints an ephemeral account, so a
 *    reviewer can click through the studio without a GitHub account.
 *
 * Sessions are JWTs (required by the credentials provider). User records live in
 * SQLite, so history and analytics are durable; only the session is stateless.
 * See SECURITY.md § Known limitations.
 */

const env = getEnv();

export const githubEnabled = Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET);

if (!githubEnabled) {
  logger.info(
    'GitHub OAuth disabled (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET not set); guest sign-in only',
  );
}

const config: NextAuthConfig = {
  ...authConfig,
  providers: [
    ...(githubEnabled
      ? [
          GitHub({
            clientId: env.AUTH_GITHUB_ID as string,
            clientSecret: env.AUTH_GITHUB_SECRET as string,
          }),
        ]
      : []),
    Credentials({
      id: 'guest',
      name: 'Guest',
      credentials: {},
      authorize: async () => {
        const guest = createGuestUser();
        return { id: guest.id, name: guest.name, isGuest: true };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'github') {
        const record = upsertUser({
          name: user.name ?? 'GitHub user',
          email: user.email ?? null,
          image: user.image ?? null,
          provider: 'github',
        });
        // Auth.js needs the database id on the user so the JWT carries it.
        user.id = record.id;
        recordEvent({ type: 'sign_in', userId: record.id, metadata: { provider: 'github' } });
      } else if (account?.provider === 'guest' && user.id) {
        recordEvent({ type: 'sign_in', userId: user.id, metadata: { provider: 'guest' } });
      }
      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
