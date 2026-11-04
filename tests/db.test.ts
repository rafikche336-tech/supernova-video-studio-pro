import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, openDatabase, setDbForTests, type Db } from '@/db/client';
import { countEvents, recordEvent } from '@/db/events';
import {
  createRender,
  getRenderById,
  getRenderBySlug,
  getRenderForUser,
  listRecentForUser,
  listRenders,
  setShareSlug,
  updateRender,
} from '@/db/renders';
import {
  countUsers,
  createGuestUser,
  getUserByEmail,
  getUserById,
  pruneStaleGuests,
  upsertUser,
} from '@/db/users';

/**
 * The data layer is exercised against a real in-memory SQLite database built
 * from the same migrations the app runs, so schema drift shows up here first.
 */

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  setDbForTests(db);
});

afterEach(() => {
  setDbForTests(null);
  db.close();
});

function makeUser(overrides: Partial<Parameters<typeof upsertUser>[0]> = {}) {
  return upsertUser({
    name: 'Test User',
    email: 'test@example.com',
    image: null,
    provider: 'github',
    ...overrides,
  });
}

describe('migrations', () => {
  it('applies once and records the version', () => {
    const rows = db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[];
    expect(rows.map((row) => row.version)).toEqual(['0001_core', '0002_live_video']);

    // Re-running is a no-op, not an error and not a duplicate.
    applyMigrations(db);
    const after = db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get() as {
      total: number;
    };
    expect(after.total).toBe(rows.length);
  });

  it('creates the tables the app depends on', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    const names = tables.map((row) => row.name);

    expect(names).toEqual(
      expect.arrayContaining(['users', 'renders', 'events', 'schema_migrations']),
    );
  });

  it('enforces foreign keys', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO renders (id, user_id, engine, prompt, status, progress, created_at, updated_at)
           VALUES ('r1', 'nobody', 'wan', 'x', 'queued', 0, 0, 0)`,
        )
        .run(),
    ).toThrow();
  });
});

describe('users', () => {
  it('creates an oauth user and reuses the row on the next sign-in', () => {
    const first = makeUser();
    const second = makeUser({ name: 'Renamed' });

    expect(second.id).toBe(first.id);
    expect(getUserById(first.id)?.name).toBe('Renamed');
    expect(countUsers()).toBe(1);
  });

  it('stores guests without an email', () => {
    const guest = createGuestUser();

    expect(guest.provider).toBe('guest');
    expect(guest.email).toBeNull();
    expect(guest.name).toMatch(/\d{4}$/);
    expect(createGuestUser().id).not.toBe(guest.id);
  });

  it('looks users up by email', () => {
    const user = makeUser({ email: 'someone@example.com' });

    expect(getUserByEmail('someone@example.com')?.id).toBe(user.id);
    expect(getUserByEmail('missing@example.com')).toBeNull();
  });

  it('prunes stale guests but keeps recent ones', () => {
    const oldGuest = createGuestUser();
    const newGuest = createGuestUser();
    const githubUser = makeUser();

    db.prepare('UPDATE users SET updated_at = 0 WHERE id = ?').run(oldGuest.id);

    const removed = pruneStaleGuests(1000 * 60 * 60 * 24 * 30);

    expect(removed).toBe(1);
    expect(getUserById(oldGuest.id)).toBeNull();
    expect(getUserById(newGuest.id)).not.toBeNull();
    expect(getUserById(githubUser.id)).not.toBeNull();
  });
});

describe('renders', () => {
  it('round-trips a render and defaults to queued', () => {
    const user = makeUser();
    const created = createRender({
      id: crypto.randomUUID(),
      userId: user.id,
      engine: 'wan',
      prompt: 'a star',
    });

    expect(created.status).toBe('queued');
    expect(created.progress).toBe(0);
    expect(created.clip).toBeNull();
    expect(getRenderById(created.id)?.prompt).toBe('a star');
  });

  it('scopes lookups by owner', () => {
    const owner = makeUser();
    const stranger = makeUser({ email: 'stranger@example.com' });
    const render = createRender({
      id: crypto.randomUUID(),
      userId: owner.id,
      engine: 'svd',
      prompt: 'ocean',
    });

    expect(getRenderForUser(render.id, owner.id)?.id).toBe(render.id);
    expect(getRenderForUser(render.id, stranger.id)).toBeNull();
  });

  it('applies partial updates and stamps updated_at', () => {
    const user = makeUser();
    const render = createRender({
      id: crypto.randomUUID(),
      userId: user.id,
      engine: 'wan',
      prompt: 'p',
    });

    const updated = updateRender(render.id, {
      status: 'succeeded',
      progress: 100,
      clip: 'desert',
      videoUrl: '/media/desert.mp4',
      posterUrl: '/media/posters/desert.jpg',
      durationMs: 4200,
    });

    expect(updated?.status).toBe('succeeded');
    expect(updated?.clip).toBe('desert');
    expect(updated?.durationMs).toBe(4200);
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(render.updatedAt);

    // An empty patch is a no-op, not a crash.
    expect(updateRender(render.id, {})?.status).toBe('succeeded');
    expect(updateRender('does-not-exist', { status: 'failed' })).toBeNull();
  });

  it('filters, paginates and counts', () => {
    const user = makeUser();

    for (let index = 0; index < 5; index += 1) {
      const render = createRender({
        id: crypto.randomUUID(),
        userId: user.id,
        engine: index % 2 === 0 ? 'wan' : 'svd',
        prompt: index % 2 === 0 ? 'galaxy over the sea' : 'a quiet forest',
      });
      updateRender(render.id, { status: index === 4 ? 'failed' : 'succeeded' });
    }

    const all = listRenders({ userId: user.id });
    expect(all.total).toBe(5);
    expect(all.items).toHaveLength(5);

    const wans = listRenders({ userId: user.id, engine: 'wan' });
    expect(wans.total).toBe(3);

    const search = listRenders({ userId: user.id, search: 'GALAXY' });
    expect(search.total).toBe(3);

    const failed = listRenders({ userId: user.id, status: 'failed' });
    expect(failed.total).toBe(1);

    const page = listRenders({ userId: user.id, limit: 2, offset: 0 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);

    // Limit is clamped so a hostile query cannot ask for everything.
    expect(listRenders({ userId: user.id, limit: 10_000 }).items.length).toBeLessThanOrEqual(60);
  });

  it('returns recent renders newest first', () => {
    const user = makeUser();

    for (const prompt of ['first', 'second', 'third']) {
      createRender({ id: crypto.randomUUID(), userId: user.id, engine: 'wan', prompt });
      db.prepare('UPDATE renders SET created_at = created_at - ?').run(1000);
    }

    const recent = listRecentForUser(user.id, 2);
    expect(recent).toHaveLength(2);
    expect(recent.map((row) => row.prompt)).toEqual(['third', 'second']);
  });

  it('keeps share slugs unique and looks them up', () => {
    const user = makeUser();
    const first = createRender({
      id: crypto.randomUUID(),
      userId: user.id,
      engine: 'wan',
      prompt: 'a',
    });
    const second = createRender({
      id: crypto.randomUUID(),
      userId: user.id,
      engine: 'wan',
      prompt: 'b',
    });

    setShareSlug(first.id, 'aaaaaaaaaa');
    expect(getRenderBySlug('aaaaaaaaaa')?.id).toBe(first.id);

    expect(() => setShareSlug(second.id, 'aaaaaaaaaa')).toThrow();
    expect(getRenderBySlug('nope')).toBeNull();
  });
});

describe('events', () => {
  it('records and counts events with filters', () => {
    const user = makeUser();
    const other = makeUser({ email: 'other@example.com' });

    recordEvent({ type: 'download', userId: user.id, renderId: null, metadata: { file: 'a.mp4' } });
    recordEvent({ type: 'download', userId: user.id });
    recordEvent({ type: 'download', userId: other.id });
    recordEvent({ type: 'share', userId: user.id });

    expect(countEvents('download')).toBe(3);
    expect(countEvents('download', { userId: user.id })).toBe(2);
    expect(countEvents('share', { userId: user.id })).toBe(1);
    expect(countEvents('download', { since: Date.now() + 1000 })).toBe(0);

    const row = db.prepare("SELECT metadata FROM events WHERE type = 'download' LIMIT 1").get() as {
      metadata: string | null;
    };
    expect(row.metadata).toContain('a.mp4');
  });

  it('survives a metadata object that cannot be serialised', () => {
    const user = makeUser();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => recordEvent({ type: 'share', userId: user.id, metadata: circular })).toThrow();
  });
});
