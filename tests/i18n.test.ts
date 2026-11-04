import { describe, expect, it } from 'vitest';
import { DICTIONARIES, LOCALES, directionFor, getDictionary, isLocale } from '@/lib/i18n';

const referenceKeys = Object.keys(DICTIONARIES.en).sort();

describe('i18n', () => {
  it('supports six locales', () => {
    expect(LOCALES).toHaveLength(6);
    expect(LOCALES).toEqual(['en', 'ar', 'fr', 'es', 'de', 'zh']);
  });

  it('has every key in every locale (no half-translated UI)', () => {
    for (const locale of LOCALES) {
      const keys = Object.keys(DICTIONARIES[locale]).sort();
      expect(keys, `locale "${locale}" has a different key set`).toEqual(referenceKeys);
    }
  });

  it('has no empty strings', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICTIONARIES[locale])) {
        expect(value, `${locale}.${key} is empty`).toBeTruthy();
        expect(String(value).trim().length, `${locale}.${key} is blank`).toBeGreaterThan(0);
      }
    }
  });

  it('declares right-to-left for Arabic and left-to-right elsewhere', () => {
    expect(directionFor('ar')).toBe('rtl');
    for (const locale of LOCALES.filter((candidate) => candidate !== 'ar')) {
      expect(directionFor(locale)).toBe('ltr');
    }
  });

  it('labels each locale with its own short code', () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale].shortLabel).toBe(locale.toUpperCase());
    }
  });

  it('validates locale input', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('xx')).toBe(false);
    expect(isLocale('__proto__')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('resolves dictionaries by locale', () => {
    expect(getDictionary('ar').dir).toBe('rtl');
    expect(getDictionary('fr').generate).toBe('Générer la vidéo');
  });
});
