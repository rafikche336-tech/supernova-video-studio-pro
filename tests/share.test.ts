import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration } from '@/lib/format';
import { safeNextPath } from '@/lib/nav';
import { generateShareSlug, isShareSlug, shareUrl } from '@/lib/share';

describe('share slugs', () => {
  it('generates 10-character url-safe ids from the same alphabet', () => {
    for (let index = 0; index < 200; index += 1) {
      const slug = generateShareSlug();
      expect(slug).toHaveLength(10);
      expect(slug).toMatch(/^[0-9a-hjkmnp-tv-z]{10}$/);
    }
  });

  it('does not repeat itself', () => {
    const slugs = new Set(Array.from({ length: 2000 }, () => generateShareSlug()));
    expect(slugs.size).toBe(2000);
  });

  it('validates slugs', () => {
    expect(isShareSlug(generateShareSlug())).toBe(true);
    expect(isShareSlug('short')).toBe(false);
    expect(isShareSlug('UPPERCASE1')).toBe(false);
    expect(isShareSlug('has space1')).toBe(false);
  });

  it('builds absolute share urls without doubling slashes', () => {
    expect(shareUrl('https://example.com', 'abcdefghij')).toBe('https://example.com/s/abcdefghij');
    expect(shareUrl('https://example.com/', 'abcdefghij')).toBe('https://example.com/s/abcdefghij');
  });
});

describe('safeNextPath', () => {
  it('keeps local paths', () => {
    expect(safeNextPath('/studio')).toBe('/studio');
    expect(safeNextPath('/history?page=2&engine=wan')).toBe('/history?page=2&engine=wan');
  });

  it('blocks open-redirect payloads', () => {
    expect(safeNextPath('//evil.com')).toBe('/studio');
    expect(safeNextPath('https://evil.com')).toBe('/studio');
    expect(safeNextPath('javascript:alert(1)')).toBe('/studio');
    expect(safeNextPath('')).toBe('/studio');
    expect(safeNextPath(undefined)).toBe('/studio');
    expect(safeNextPath(null)).toBe('/studio');
    expect(safeNextPath(['/studio'])).toBe('/studio');
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBe('/studio');
  });

  it('honours a custom fallback', () => {
    expect(safeNextPath('https://evil.com', '/history')).toBe('/history');
  });
});

describe('formatting helpers', () => {
  it('formats durations across magnitudes', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(640)).toBe('640 ms');
    expect(formatDuration(4200)).toBe('4.2 s');
    expect(formatDuration(125_000)).toBe('2.1 min');
  });

  it('groups thousands', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});
