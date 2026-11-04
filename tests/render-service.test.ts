import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, setDbForTests, type Db } from '@/db/client';
import { countEvents } from '@/db/events';
import { getRenderById, listRenders } from '@/db/renders';
import { upsertUser } from '@/db/users';
import { resetEnvCache } from '@/lib/env';
import { resetRenderProvider } from '@/lib/render';
import { pollRender, startRender } from '@/lib/render/service';

/**
 * The service is the only place where provider state and the database meet, so
 * it is tested against the real demo provider and a real (in-memory) database.
 * The live path is covered end to end by the integration suite against a stub
 * fal server.
 */

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  setDbForTests(db);

  process.env.RENDER_PROVIDER = 'demo';
  delete process.env.FAL_KEY;
  delete process.env.REPLICATE_API_TOKEN;
  resetEnvCache();
  resetRenderProvider();
});

afterEach(() => {
  setDbForTests(null);
  db.close();
  delete process.env.RENDER_PROVIDER;
  resetEnvCache();
  resetRenderProvider();
});

function makeUser(email = 'service@example.com') {
  return upsertUser({ name: 'Service', email, image: null, provider: 'github' });
}

describe('startRender', () => {
  it('creates an owned row and records a start event', async () => {
    const user = makeUser();

    const record = await startRender({
      userId: user.id,
      prompt: 'a desert at dawn',
      engine: 'wan',
    });

    expect(record.userId).toBe(user.id);
    expect(record.status).toBe('queued');
    expect(record.provider).toBe('demo');
    expect(record.providerJobId).toMatch(/^demo:/);
    expect(getRenderById(record.id)?.prompt).toBe('a desert at dawn');
    expect(countEvents('render_started', { userId: user.id })).toBe(1);
  });

  it('scopes the new render to its owner', async () => {
    const owner = makeUser('owner@example.com');
    const stranger = makeUser('stranger@example.com');

    const record = await startRender({ userId: owner.id, prompt: 'a storm', engine: 'wan' });

    expect(listRenders({ userId: owner.id }).total).toBe(1);
    expect(listRenders({ userId: stranger.id }).total).toBe(0);
    expect(await pollRender(stranger.id, record.id)).toBeNull();
  });
});

describe('pollRender', () => {
  it('mirrors provider progress and completion into the database', async () => {
    const user = makeUser();
    const started = await startRender({ userId: user.id, prompt: 'a neon street', engine: 'wan' });

    // The demo provider finishes in ~1.5 s; force the row's clock back instead of
    // waiting, so the test stays instant.
    db.prepare('UPDATE renders SET created_at = created_at - 5000 WHERE id = ?').run(started.id);

    const done = await pollRender(user.id, started.id);

    expect(done?.status).toBe('succeeded');
    expect(done?.progress).toBe(100);
    expect(done?.clip).toBeTruthy();
    expect(done?.videoUrl).toBe(`/media/${done?.clip}.mp4`);
    expect(done?.posterUrl).toBe(`/media/posters/${done?.clip}.jpg`);
    expect(done?.durationMs).toBeGreaterThan(0);
    expect(countEvents('render_succeeded', { userId: user.id })).toBe(1);
  });

  it('does not double-log a completion when polled again', async () => {
    const user = makeUser();
    const started = await startRender({ userId: user.id, prompt: 'a forest', engine: 'wan' });
    db.prepare('UPDATE renders SET created_at = created_at - 5000 WHERE id = ?').run(started.id);

    await pollRender(user.id, started.id);
    await pollRender(user.id, started.id);

    expect(countEvents('render_succeeded', { userId: user.id })).toBe(1);
  });

  it('returns null for an unknown render', async () => {
    const user = makeUser();
    expect(await pollRender(user.id, crypto.randomUUID())).toBeNull();
  });

  it('fails a job whose provider forgot it, once the grace window passed', async () => {
    const user = makeUser();
    const started = await startRender({ userId: user.id, prompt: 'a tunnel', engine: 'wan' });

    // Simulate the provider losing the job.
    db.prepare(
      'UPDATE renders SET provider_job_id = ?, created_at = created_at - 600000 WHERE id = ?',
    ).run('demo:does-not-exist', started.id);

    const failed = await pollRender(user.id, started.id);

    expect(failed?.status).toBe('failed');
    expect(failed?.error).toMatch(/expired/i);
    expect(countEvents('render_failed', { userId: user.id })).toBe(1);
  });

  it('keeps a young job alive while the provider is flaky', async () => {
    const user = makeUser();
    const started = await startRender({ userId: user.id, prompt: 'a galaxy', engine: 'wan' });

    db.prepare('UPDATE renders SET provider_job_id = ? WHERE id = ?').run(
      'fal:not-configured',
      started.id,
    );

    const still = await pollRender(user.id, started.id);
    expect(still?.status).toBe('queued');
  });
});
