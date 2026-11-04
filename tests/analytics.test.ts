import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb, openDatabase, setDbForTests, type Db } from '@/db/client';
import { recordEvent } from '@/db/events';
import { upsertUser } from '@/db/users';
import { ANALYTICS_WINDOW_DAYS, getAnalytics } from '@/lib/analytics';

const DAY = 86_400_000;
let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  setDbForTests(db);
});

afterEach(() => {
  setDbForTests(null);
  db.close();
});

function makeUser(email = 'analytics@example.com') {
  return upsertUser({ name: 'Analytics', email, image: null, provider: 'github' });
}

function insertRender(options: {
  id: string;
  userId: string;
  daysAgo: number;
  status: 'succeeded' | 'failed' | 'running';
  engine?: string;
  durationMs?: number | null;
}) {
  const createdAt = Date.now() - options.daysAgo * DAY;
  getDb()
    .prepare(
      `INSERT INTO renders (id, user_id, engine, prompt, status, progress, duration_ms, created_at, updated_at)
       VALUES (?, ?, ?, 'prompt', ?, 100, ?, ?, ?)`,
    )
    .run(
      options.id,
      options.userId,
      options.engine ?? 'wan',
      options.status,
      options.durationMs ?? null,
      createdAt,
      createdAt,
    );
}

describe('getAnalytics', () => {
  it('returns a zeroed window for a new account', () => {
    const user = makeUser();
    const data = getAnalytics(user.id);

    expect(data.windowDays).toBe(ANALYTICS_WINDOW_DAYS);
    expect(data.personal.renders).toBe(0);
    expect(data.personal.successRate).toBe(0);
    expect(data.personal.avgDurationMs).toBeNull();
    expect(data.personal.downloads).toBe(0);
    expect(data.daily).toHaveLength(ANALYTICS_WINDOW_DAYS);
    expect(data.daily.every((point) => point.total === 0)).toBe(true);
    expect(data.engines).toEqual([]);
  });

  it('aggregates volume, success rate and average duration', () => {
    const user = makeUser();

    insertRender({ id: 'a', userId: user.id, daysAgo: 0, status: 'succeeded', durationMs: 4000 });
    insertRender({ id: 'b', userId: user.id, daysAgo: 1, status: 'succeeded', durationMs: 6000 });
    insertRender({ id: 'c', userId: user.id, daysAgo: 2, status: 'failed' });
    insertRender({ id: 'd', userId: user.id, daysAgo: 3, status: 'running' });

    const data = getAnalytics(user.id);

    expect(data.personal.renders).toBe(4);
    expect(data.personal.succeeded).toBe(2);
    expect(data.personal.failed).toBe(1);
    expect(data.personal.successRate).toBe(50);
    expect(data.personal.avgDurationMs).toBe(5000);
  });

  it('ignores renders outside the window', () => {
    const user = makeUser();

    insertRender({ id: 'recent', userId: user.id, daysAgo: 1, status: 'succeeded' });
    insertRender({
      id: 'old',
      userId: user.id,
      daysAgo: ANALYTICS_WINDOW_DAYS + 5,
      status: 'succeeded',
    });

    const data = getAnalytics(user.id);

    expect(data.personal.renders).toBe(1);
    expect(data.daily.reduce((sum, point) => sum + point.total, 0)).toBe(1);
  });

  it('buckets renders by UTC day and ends today', () => {
    const user = makeUser();
    insertRender({ id: 'today', userId: user.id, daysAgo: 0, status: 'succeeded' });
    insertRender({ id: 'yesterday', userId: user.id, daysAgo: 1, status: 'succeeded' });

    const data = getAnalytics(user.id);
    const last = data.daily[data.daily.length - 1];
    const penultimate = data.daily[data.daily.length - 2];

    expect(last?.total).toBe(1);
    expect(penultimate?.total).toBe(1);
    expect(data.daily.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))).toBe(true);
  });

  it('orders the engine mix by count and resolves display names', () => {
    const user = makeUser();

    insertRender({ id: '1', userId: user.id, daysAgo: 0, status: 'succeeded', engine: 'wan' });
    insertRender({ id: '2', userId: user.id, daysAgo: 0, status: 'succeeded', engine: 'svd' });
    insertRender({ id: '3', userId: user.id, daysAgo: 0, status: 'succeeded', engine: 'svd' });

    const data = getAnalytics(user.id);

    expect(data.engines[0]).toEqual({ engine: 'svd', name: 'SVD XT', count: 2 });
    expect(data.engines[1]).toEqual({ engine: 'wan', name: 'WAN 2.2', count: 1 });
  });

  it('counts downloads and shares from the event log', () => {
    const user = makeUser();
    insertRender({ id: 'render', userId: user.id, daysAgo: 0, status: 'succeeded' });

    recordEvent({ type: 'download', userId: user.id, renderId: 'render' });
    recordEvent({ type: 'download', userId: user.id, renderId: 'render' });
    recordEvent({ type: 'share', userId: user.id, renderId: 'render' });

    const data = getAnalytics(user.id);
    expect(data.personal.downloads).toBe(2);
    expect(data.personal.shares).toBe(1);
  });

  it('reports platform-wide numbers separately from personal ones', () => {
    const me = makeUser('me@example.com');
    const someoneElse = makeUser('someone@example.com');

    insertRender({ id: 'mine', userId: me.id, daysAgo: 0, status: 'succeeded' });
    insertRender({ id: 'theirs', userId: someoneElse.id, daysAgo: 0, status: 'succeeded' });

    const data = getAnalytics(me.id);

    expect(data.personal.renders).toBe(1);
    expect(data.platform.renders).toBe(2);
    expect(data.platform.users).toBe(2);
    expect(data.platform.rendersToday).toBe(2);
    expect(data.platform.clips).toBeGreaterThanOrEqual(24);
  });
});
