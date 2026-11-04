'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ENGINES } from '@/lib/engines/registry';
import { formatDateTime } from '@/lib/format';
import { DEFAULT_LOCALE, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import type { RenderJob } from '@/lib/render/types';
import { EngineCard } from './EngineCard';
import { LanguagePicker } from './LanguagePicker';
import styles from './StudioWorkbench.module.css';

const LOCALE_STORAGE_KEY = 'supernova:locale';

function subscribeToLocale(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export interface StudioWorkbenchProps {
  readonly initialLocale: Locale;
  readonly demoMode: boolean;
  readonly recent: readonly RenderJob[];
}

/**
 * The studio's client island.
 *
 * Server-rendered: the page shell, the history rail's initial contents, the
 * signed-in user. Client-rendered: language state and live job status only.
 */
export function StudioWorkbench({ initialLocale, demoMode, recent }: StudioWorkbenchProps) {
  const storedLocale = useSyncExternalStore(
    subscribeToLocale,
    readStoredLocale,
    () => initialLocale,
  );
  const [chosenLocale, setChosenLocale] = useState<Locale | null>(null);
  const locale = chosenLocale ?? storedLocale;
  const dictionary = getDictionary(locale);

  const [renders, setRenders] = useState<readonly RenderJob[]>(recent);

  const handleLocaleChange = useCallback((next: Locale) => {
    setChosenLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just will not survive a reload.
    }
  }, []);

  const handleRendered = useCallback((job: RenderJob) => {
    setRenders((previous) => [job, ...previous.filter((item) => item.id !== job.id)].slice(0, 6));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dictionary.dir;
  }, [locale, dictionary.dir]);

  return (
    <div className={styles.layout}>
      <section className={styles.main} aria-labelledby="engines-title">
        <div className={styles.toolbar}>
          <div>
            <h1 id="engines-title" className={styles.title}>
              Generate
            </h1>
            <p className={styles.subtitle}>
              Pick a profile, describe the shot, get a clip — every render is saved to your history.
            </p>
          </div>

          <div className={styles.tools}>
            <span className={styles.count}>{ENGINES.length} engines</span>
            <LanguagePicker
              locale={locale}
              onChange={handleLocaleChange}
              label={dictionary.languageLabel}
            />
          </div>
        </div>

        {demoMode ? (
          <p className={styles.demoNotice} role="note">
            {dictionary.demoNotice}
          </p>
        ) : null}

        <ul className={styles.grid}>
          {ENGINES.map((engine, index) => (
            <li
              key={engine.id}
              className={`${styles.gridItem} stagger`}
              style={{ ['--i' as string]: index }}
            >
              <EngineCard
                engine={engine}
                dictionary={dictionary}
                locale={locale}
                onRendered={handleRendered}
              />
            </li>
          ))}
        </ul>
      </section>

      <aside className={styles.rail} aria-labelledby="recent-title">
        <div className={styles.railHead}>
          <h2 id="recent-title" className={styles.railTitle}>
            {dictionary.recentRenders}
          </h2>
          <Link href="/history" className={styles.railLink}>
            All →
          </Link>
        </div>

        {renders.length === 0 ? (
          <p className={styles.empty}>{dictionary.noRenders}</p>
        ) : (
          <ul className={styles.recentList}>
            {renders.map((render, index) => (
              <li
                key={render.id}
                className={`${styles.recentItem} fadeIn`}
                style={{ ['--i' as string]: index }}
              >
                <span
                  className={styles.thumb}
                  style={
                    render.posterUrl ? { backgroundImage: `url(${render.posterUrl})` } : undefined
                  }
                  aria-hidden="true"
                />
                <span className={styles.recentBody}>
                  <span className={`${styles.recentPrompt} truncate2`}>{render.prompt}</span>
                  <span className={styles.recentMeta}>
                    {render.engine.toUpperCase()} · {formatDateTime(render.updatedAt)}
                  </span>
                </span>
                <span className={styles.badge} data-status={render.status}>
                  {render.status === 'succeeded' ? '✓' : render.status === 'failed' ? '!' : '…'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
