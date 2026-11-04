import type { NextAuthConfig } from 'next-auth';
import { getEnv } from './env';
import { logger } from './logger';

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * The middleware imports *this* file, so it must not pull in the database
 * driver: better-sqlite3 is a native Node module and cannot run on the edge.
 * Providers and database callbacks are added in `lib/auth.ts`, which only the
 * Node runtime (route handlers, server components) ever loads.
 */

const env = getEnv();

/**
 * Auth.js needs a secret to sign session cookies.
 *
 * It must not throw at module scope: `next build` runs with NODE_ENV=production
 * and would fail before a secret could be injected. Warn loudly instead and let
 * Auth.js refuse to sign sessions without one.
 */
function resolveSecret(): string | undefined {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;

  if (env.NODE_ENV === 'production') {
    logger.warn(
      'AUTH_SECRET is not set — sign-in will fail in production. Generate one with: openssl rand -base64 32',
    );
    return undefined;
  }

  // Development and CI only: a fixed throwaway secret keeps `npm run dev` and
  // the integration suite working without configuration.
  return 'supernova-development-secret-do-not-use-in-production';
}

export const authConfig = {
  secret: resolveSecret(),
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === 'string') {
        session.user.id = token.uid;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
