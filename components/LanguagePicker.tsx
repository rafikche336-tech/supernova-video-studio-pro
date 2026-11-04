'use client';

import { DICTIONARIES, LOCALES, type Locale } from '@/lib/i18n';
import styles from './LanguagePicker.module.css';

export interface LanguagePickerProps {
  readonly locale: Locale;
  readonly onChange: (locale: Locale) => void;
  readonly label: string;
}

/**
 * Language switcher.
 *
 * Each chip carries its own `lang` attribute so a screen reader pronounces
 * "العربية" in Arabic, and `aria-pressed` communicates the current choice.
 */
export function LanguagePicker({ locale, onChange, label }: LanguagePickerProps) {
  return (
    <div className={styles.picker} role="group" aria-label={label}>
      {LOCALES.map((option) => {
        const dictionary = DICTIONARIES[option];
        const isActive = option === locale;

        return (
          <button
            key={option}
            type="button"
            lang={option}
            className={isActive ? `${styles.chip} ${styles.active}` : styles.chip}
            aria-pressed={isActive}
            onClick={() => onChange(option)}
          >
            {dictionary.shortLabel}
            <span className="srOnly"> — {dictionary.label}</span>
          </button>
        );
      })}
    </div>
  );
}
