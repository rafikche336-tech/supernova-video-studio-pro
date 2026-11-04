import type { DefaultSession } from 'next-auth';

/**
 * The studio keys everything off the database user id, so it has to survive the
 * trip into the session object.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isGuest?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    isGuest?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
  }
}
