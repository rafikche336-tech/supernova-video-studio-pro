/**
 * Only ever bounce back to a path on this site.
 *
 * `next=//evil.com` and `next=https://evil.com` are both open-redirect vectors
 * on a login form, so anything that is not a single-slash absolute path is
 * replaced with the default destination.
 */
export function safeNextPath(value: unknown, fallback = '/studio'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.length > 512) return fallback;
  return value;
}
