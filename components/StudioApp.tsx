'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ENGINES } from '@/lib/engines/registry';
import { DEFAULT_LOCALE, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { EngineCard } from './EngineCard';
import { LanguagePicker } from './LanguagePicker';
import { StarfieldCanvas } from './StarfieldCanvas';
import styles from './StudioApp.module.css';

const LOCALE_STORAGE_KEY = 'supernova:locale';

/*
 * The saved language lives in localStorage, which React cannot read during
 * render without breaking hydration. `useSyncExternalStore` is the supported
 * way to read external state: the server snapshot is rendered first, then the
 * client snapshot takes over after hydration — no mismatch, no effect-setState.
 */
function subscribeToLocale(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Private mode / blocked storage — fall back to the default language.
    return DEFAULT_LOCALE;
  }
}

export interface StudioAppProps {
  readonly initialLocale: Locale;
  readonly demoMode: boolean;
}

/**
 * The single client island: language state plus the engine grid.
 * Everything else on the page stays on the server.
 */
export function StudioApp({ initialLocale, demoMode }: StudioAppProps) {
  const storedLocale = useSyncExternalStore(
    subscribeToLocale,
    readStoredLocale,
    () => initialLocale,
  );

  // Explicit choice in this tab wins over whatever is in storage.
  const [chosenLocale, setChosenLocale] = useState<Locale | null>(null);
  const locale = chosenLocale ?? storedLocale;
  const dictionary = getDictionary(locale);

  const handleLocaleChange = useCallback((next: Locale) => {
    setChosenLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just will not survive a reload.
    }
  }, []);

  // Keep the document language and direction in sync with the UI language so
  // assistive tech announces the right language and RTL layouts work.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dictionary.dir;
  }, [locale, dictionary.dir]);

  return (
    <>
      <StarfieldCanvas />

      <div className={styles.shell}>
        <header className={styles.header}>
          <LanguagePicker
            locale={locale}
            onChange={handleLocaleChange}
            label={dictionary.languageLabel}
          />

          <div className={styles.hero}>
            <h1 className={styles.title}>
              {dictionary.brand} <span className={styles.accent}>{dictionary.brandAccent}</span>
            </h1>
            <p className={styles.tagline}>{dictionary.tagline}</p>
            {demoMode ? (
              <p className={styles.demoNotice} role="note">
                {dictionary.demoNotice}
              </p>
            ) : null}
          </div>
        </header>

        <main id="studio" className={styles.main}>
          <h2 className="srOnly">{dictionary.enginesTitle}</h2>

          <ul className={styles.grid}>
            {ENGINES.map((engine) => (
              <li key={engine.id} className={styles.gridItem}>
                <EngineCard engine={engine} dictionary={dictionary} locale={locale} />
              </li>
            ))}
          </ul>
        </main>

        <footer className={styles.footer}>
          <p>{dictionary.footer}</p>
        </footer>
      </div>
    </>
  );
}
