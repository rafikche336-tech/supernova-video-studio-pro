'use client';

import { useEffect } from 'react';
import styles from './status.module.css';

/**
 * Route-level error boundary. Without this file any render error shows Next's
 * default screen and nothing is reported.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with your error tracker (Sentry, Bugsnag…) — the digest is the
    // only identifier the server exposes for production errors.
    console.error('[ui] unhandled error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className={styles.wrapper}>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.text}>
        The studio hit an unexpected error. Your prompts are untouched — try again.
      </p>
      <button type="button" className={styles.action} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
