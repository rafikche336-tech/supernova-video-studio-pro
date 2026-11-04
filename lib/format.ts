/**
 * Deterministic formatting helpers.
 *
 * Everything renders in UTC on purpose: the same string is produced on the
 * server and on the client, so hydration never mismatches. A future "local time"
 * toggle should read the zone in a `useSyncExternalStore` hook, not here.
 */

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
});

export function formatDateTime(value: string | number): string {
  return DATE_TIME.format(new Date(value));
}

export function formatDay(value: string | number): string {
  return DAY_LABEL.format(new Date(value));
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

/** `2026-11-04` → `4 Nov` (used as an axis tick). */
export function formatAxisDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-');
  if (!year || !month || !day) return isoDay;
  return `${Number(day)} ${new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  ).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
}
