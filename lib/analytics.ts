import { getDb } from '@/db/client';
import { countEvents } from '@/db/events';
import { CLIPS, ENGINES, isEngineId, type EngineId } from '@/lib/engines/registry';

/**
 * Analytics aggregation.
 *
 * Deliberately SQL + plain objects (no chart or BI dependency): the dashboard
 * renders its own SVG from this shape, and the numbers can be unit-tested
 * against a fixture database.
 */

export const ANALYTICS_WINDOW_DAYS = 14;

export interface DayPoint {
  /** UTC date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly total: number;
  readonly succeeded: number;
}

export interface EngineSlice {
  readonly engine: EngineId;
  readonly name: string;
  readonly count: number;
}

export interface PersonalStats {
  readonly renders: number;
  readonly succeeded: number;
  readonly failed: number;
  /** 0–100, rounded. */
  readonly successRate: number;
  readonly downloads: number;
  readonly shares: number;
  readonly avgDurationMs: number | null;
}

export interface PlatformStats {
  readonly renders: number;
  readonly users: number;
  readonly clips: number;
  readonly rendersToday: number;
}

export interface AnalyticsData {
  readonly windowDays: number;
  readonly personal: PersonalStats;
  readonly platform: PlatformStats;
  readonly daily: DayPoint[];
  readonly engines: EngineSlice[];
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function getAnalytics(userId: string, now = Date.now()): AnalyticsData {
  const db = getDb();
  const todayStart = startOfUtcDay(new Date(now));
  const windowStart = todayStart - (ANALYTICS_WINDOW_DAYS - 1) * 86_400_000;

  const windowRows = db
    .prepare(
      `SELECT date(created_at / 1000, 'unixepoch') AS day,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded
         FROM renders
        WHERE user_id = ? AND created_at >= ?
        GROUP BY day`,
    )
    .all(userId, windowStart) as { day: string; total: number; succeeded: number }[];

  const byDay = new Map(windowRows.map((row) => [row.day, row]));

  const daily: DayPoint[] = Array.from({ length: ANALYTICS_WINDOW_DAYS }, (_, index) => {
    const date = isoDay(windowStart + index * 86_400_000);
    const row = byDay.get(date);
    return { date, total: row?.total ?? 0, succeeded: row?.succeeded ?? 0 };
  });

  const engineRows = db
    .prepare(
      `SELECT engine, COUNT(*) AS count
         FROM renders
        WHERE user_id = ? AND created_at >= ?
        GROUP BY engine
        ORDER BY count DESC`,
    )
    .all(userId, windowStart) as { engine: string; count: number }[];

  const engines: EngineSlice[] = engineRows
    .filter((row) => isEngineId(row.engine))
    .map((row) => ({
      engine: row.engine as EngineId,
      name: ENGINES.find((engine) => engine.id === row.engine)?.name ?? row.engine,
      count: row.count,
    }));

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS renders,
              SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
              AVG(CASE WHEN status = 'succeeded' THEN duration_ms END) AS avg_duration
         FROM renders
        WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, windowStart) as {
    renders: number;
    succeeded: number | null;
    failed: number | null;
    avg_duration: number | null;
  };

  const renders = totals.renders ?? 0;
  const succeeded = totals.succeeded ?? 0;
  const failed = totals.failed ?? 0;

  const platform = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM renders) AS renders,
              (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM renders WHERE created_at >= ?) AS renders_today`,
    )
    .get(todayStart) as { renders: number; users: number; renders_today: number };

  return {
    windowDays: ANALYTICS_WINDOW_DAYS,
    personal: {
      renders,
      succeeded,
      failed,
      successRate: renders === 0 ? 0 : Math.round((succeeded / renders) * 100),
      downloads: countEvents('download', { userId, since: windowStart }),
      shares: countEvents('share', { userId, since: windowStart }),
      avgDurationMs: totals.avg_duration === null ? null : Math.round(totals.avg_duration),
    },
    platform: {
      renders: platform.renders,
      users: platform.users,
      clips: Object.keys(CLIPS).length,
      rendersToday: platform.renders_today,
    },
    daily,
    engines,
  };
}
