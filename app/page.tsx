import { StudioApp } from '@/components/StudioApp';
import { isDemoMode } from '@/lib/env';
import { DEFAULT_LOCALE, getDictionary } from '@/lib/i18n';
import styles from './page.module.css';

/**
 * Server component shell.
 *
 * Everything static (metadata, the no-JS fallback) is rendered on the server;
 * the interactive studio is a single client island. v1 marked the whole page
 * `'use client'`, which shipped ~90 kB of JS before first paint.
 */
export default function HomePage() {
  const dictionary = getDictionary(DEFAULT_LOCALE);

  return (
    <div className={styles.page}>
      <a className="skipLink" href="#studio">
        {dictionary.skipToContent}
      </a>

      <StudioApp initialLocale={DEFAULT_LOCALE} demoMode={isDemoMode()} />

      <noscript>
        <p className={styles.noscript}>{dictionary.requiresJavaScript}</p>
      </noscript>
    </div>
  );
}
