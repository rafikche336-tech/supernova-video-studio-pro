#!/usr/bin/env node
/**
 * Seeds a local database with a believable demo history.
 *
 *   npm run seed              # add demo data (idempotent unless --reset)
 *   npm run seed -- --reset   # wipe renders/events/users first
 *   npm run seed -- --days=30
 *
 * Plain Node + better-sqlite3 so it shares the exact schema file the app uses
 * (`db/migrations.mjs`). Output is deterministic: the same seed produces the
 * same history, which keeps screenshots and docs stable.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { migrations } from '../db/migrations.mjs';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const daysArg = args.find((arg) => arg.startsWith('--days='));
const windowDays = Math.min(Math.max(Number(daysArg?.split('=')[1] ?? 14), 1), 90);

const configuredPath = process.env.DATABASE_PATH ?? 'data/supernova.db';
const dbPath = configuredPath === ':memory:' ? configuredPath : join(process.cwd(), configuredPath);

if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ------------------------------------------------------------------ schema */

db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));

for (const migration of migrations) {
  if (applied.has(migration.version)) continue;
  db.transaction(() => {
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      Date.now(),
    );
  })();
}

if (reset) {
  db.exec('DELETE FROM events; DELETE FROM renders; DELETE FROM users;');
  console.log('cleared users, renders and events');
}

/* ------------------------------------------------------------- fake people */

const DEMO_EMAIL = 'demo@supernova.studio';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL);

if (existing) {
  console.log(`demo data already present (${DEMO_EMAIL}) — pass --reset to rebuild`);
  summarize();
  process.exit(0);
}

const now = Date.now();
const DAY = 86_400_000;

const people = [
  { name: 'Demo Account', email: DEMO_EMAIL, provider: 'github', image: null, weight: 6 },
  { name: 'Nova 4821', email: null, provider: 'guest', image: null, weight: 2 },
  { name: 'Orbit 7743', email: null, provider: 'guest', image: null, weight: 2 },
  { name: 'Rigel 2094', email: null, provider: 'guest', image: null, weight: 1 },
];

const insertUser = db.prepare(
  `INSERT INTO users (id, name, email, image, provider, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const users = people.map((person) => {
  const id = randomUUID();
  const createdAt = now - windowDays * DAY;
  insertUser.run(id, person.name, person.email, person.image, person.provider, createdAt, now);
  return { ...person, id };
});

const insertRender = db.prepare(
  `INSERT INTO renders
     (id, user_id, engine, prompt, status, progress, clip, video_url, poster_url, error, duration_ms,
      share_slug, shared_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const insertEvent = db.prepare(
  `INSERT INTO events (id, user_id, type, render_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
);

/* ------------------------------------------------------------- fake prompts */

const PROMPTS = [
  ['A cinematic dune sea at golden hour, slow crane up', 'desert'],
  ['Neon rain in a narrow alley, reflections on wet asphalt', 'neon'],
  ['Aurora ribbons over a frozen lake at midnight', 'aurora'],
  ['Molten cracks spreading across cooled lava at night', 'lava'],
  ['Cherry petals drifting through soft spring light', 'blossom'],
  ['Slow spiral of a galaxy seen from far above', 'galaxy'],
  ['Lightning inside towering storm clouds', 'storm'],
  ['Sunlight shafts cutting through turquoise water', 'underwater'],
  ['Ancient temple columns in warm dusty light', 'ruins'],
  ['Snow drifting over blue ridges at dusk', 'snow'],
  ['Firework bursts blooming over a dark skyline', 'fireworks'],
  ['Embers rising through smoke from a dying fire', 'embers'],
  ['Layered mountain ridges fading into haze', 'mountain'],
  ['Rain on a window with bokeh city lights behind', 'rainwindow'],
  ['Retro-futuristic neon grid horizon, sweeping scanline', 'cyber'],
  ['Gold light rings receding down a tunnel', 'tunnel'],
  ['Violet ink blooming in dark water, macro shot', 'ink'],
  ['Layered cloudscape drifting through a pale sky', 'clouds'],
  ['Drifting starfield with a gold meteor trail', 'space'],
  ['Moonlit ocean swell with shimmering highlights', 'ocean'],
  ['Night city skyline with flickering windows', 'city'],
  ['Woodland ridges fading into green mist', 'forest'],
];

const ENGINES = ['wan', 'mochi', 'svd', 'shorts', 'ai', 'edge', 'ultra', 'ent'];
const SLUG_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** Small deterministic PRNG so repeat runs look identical. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = makeRandom(20261104);
const pick = (list) => list[Math.floor(random() * list.length)];

function slug() {
  let value = '';
  for (let i = 0; i < 10; i += 1) value += SLUG_ALPHABET[Math.floor(random() * SLUG_ALPHABET.length)];
  return value;
}

/* ----------------------------------------------------------------- generate */

const weightedUsers = users.flatMap((user) => Array.from({ length: user.weight }, () => user));
let renderCount = 0;
let eventCount = 0;

for (const user of users) {
  insertEvent.run(randomUUID(), user.id, 'sign_in', null, JSON.stringify({ provider: user.provider }), now - windowDays * DAY);
  eventCount += 1;
}

for (let day = windowDays - 1; day >= 0; day -= 1) {
  // Weekends are quieter; recent days slightly busier — makes the chart readable.
  const date = new Date(now - day * DAY);
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
  const base = weekend ? 3 : 6;
  const count = Math.max(1, Math.round(base + random() * 4 - (day > windowDays - 3 ? 2 : 0)));

  for (let i = 0; i < count; i += 1) {
    const user = pick(weightedUsers);
    const [prompt, clip] = pick(PROMPTS);
    const engine = pick(ENGINES);
    const createdAt = now - day * DAY - Math.floor(random() * DAY);
    const roll = random();

    const status = roll > 0.94 ? 'failed' : roll > 0.88 ? 'running' : 'succeeded';
    const id = randomUUID();
    const shared = status === 'succeeded' && random() > 0.82;
    const shareSlug = shared ? slug() : null;
    const durationMs = status === 'succeeded' ? 4200 + Math.floor(random() * 5200) : null;

    insertRender.run(
      id,
      user.id,
      engine,
      prompt,
      status,
      status === 'succeeded' ? 100 : status === 'failed' ? 63 : 40,
      status === 'queued' ? null : clip,
      status === 'succeeded' ? `/media/${clip}.mp4` : null,
      status === 'succeeded' ? `/media/posters/${clip}.jpg` : null,
      status === 'failed' ? 'Provider returned an empty frame buffer.' : null,
      durationMs,
      shareSlug,
      shared ? createdAt + 60_000 : null,
      createdAt,
      createdAt + (durationMs ?? 1000),
    );
    renderCount += 1;

    insertEvent.run(randomUUID(), user.id, 'render_started', id, JSON.stringify({ engine }), createdAt);
    eventCount += 1;

    if (status === 'succeeded') {
      insertEvent.run(
        randomUUID(),
        user.id,
        'render_succeeded',
        id,
        JSON.stringify({ engine, clip }),
        createdAt + (durationMs ?? 1000),
      );
      eventCount += 1;

      if (random() > 0.55) {
        insertEvent.run(randomUUID(), user.id, 'download', id, null, createdAt + 120_000);
        eventCount += 1;
      }
      if (shared) {
        insertEvent.run(randomUUID(), user.id, 'share', id, JSON.stringify({ slug: shareSlug }), createdAt + 60_000);
        eventCount += 1;
      }
    } else if (status === 'failed') {
      insertEvent.run(randomUUID(), user.id, 'render_failed', id, JSON.stringify({ engine }), createdAt + 800);
      eventCount += 1;
    }
  }
}

function summarize() {
  const rows = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM renders) AS renders,
              (SELECT COUNT(*) FROM events) AS events,
              (SELECT COUNT(*) FROM renders WHERE share_slug IS NOT NULL) AS shared`,
    )
    .get();
  console.log(
    `seeded ${dbPath}: ${rows.users} users, ${rows.renders} renders (${rows.shared} shared), ${rows.events} events`,
  );
}

summarize();
db.close();
