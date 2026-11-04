'use client';

import { useCallback, useState } from 'react';
import styles from './ShareButton.module.css';

export interface ShareButtonProps {
  readonly renderId: string;
  readonly title: string;
  readonly label: string;
  readonly copiedLabel: string;
  readonly compact?: boolean;
}

type ShareState = 'idle' | 'working' | 'copied' | 'error';

/**
 * Creates (or reuses) the public link for a render, then hands it to the OS.
 *
 * - Mobile + desktop Chrome/Safari: `navigator.share` opens the native sheet.
 * - Everything else: the link is copied to the clipboard and we say so.
 * - Both paths fail closed with a readable message rather than doing nothing.
 */
export function ShareButton({ renderId, title, label, copiedLabel, compact }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>('idle');

  const handleClick = useCallback(async () => {
    setState('working');

    try {
      const response = await fetch(`/api/share/${renderId}`, {
        method: 'POST',
        headers: { accept: 'application/json' },
      });

      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Could not create a share link.');
      }

      const url = payload.url;

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text: title, url });
          setState('idle');
          return;
        } catch (error) {
          // User dismissed the sheet — not an error worth reporting.
          if (error instanceof DOMException && error.name === 'AbortError') {
            setState('idle');
            return;
          }
        }
      }

      await navigator.clipboard.writeText(url);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2600);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 3200);
    }
  }, [renderId, title]);

  const busy = state === 'working';

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={`btn btnSmall ${styles.button}${compact ? ` ${styles.compact}` : ''}`}
        onClick={handleClick}
        disabled={busy}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
          <path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
        </svg>
        {busy ? '…' : state === 'copied' ? copiedLabel : label}
      </button>
      <span role="status" aria-live="polite" className={styles.status}>
        {state === 'error' ? 'Could not share — try again.' : ''}
      </span>
    </span>
  );
}
