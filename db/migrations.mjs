/**
 * Database migrations.
 *
 * Plain ESM so that *both* the TypeScript app (`db/client.ts`) and the plain-Node
 * seed script (`scripts/seed.mjs`) can import the exact same definitions — one
 * source of truth, no drift between seeding and the app schema.
 *
 * Dialect notes: all ids are TEXT UUIDs and all timestamps are INTEGER epoch
 * milliseconds, which keeps the schema portable to Postgres (see
 * docs/ARCHITECTURE.md § Database portability).
 */

/**
 * @typedef {{ version: string; name: string; sql: string }} Migration
 */

/** @type {Migration[]} */
export const migrations = [
  {
    version: '0001_core',
    name: 'users, renders, events',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT UNIQUE,
        image       TEXT,
        provider    TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

      CREATE TABLE IF NOT EXISTS renders (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        engine       TEXT NOT NULL,
        prompt       TEXT NOT NULL,
        status       TEXT NOT NULL,
        progress     INTEGER NOT NULL DEFAULT 0,
        clip         TEXT,
        video_url    TEXT,
        poster_url   TEXT,
        error        TEXT,
        duration_ms  INTEGER,
        share_slug   TEXT UNIQUE,
        shared_at    INTEGER,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS renders_user_created_idx ON renders (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS renders_status_idx ON renders (status);
      CREATE INDEX IF NOT EXISTS renders_share_slug_idx ON renders (share_slug);

      CREATE TABLE IF NOT EXISTS events (
        id          TEXT PRIMARY KEY,
        user_id     TEXT,
        type        TEXT NOT NULL,
        render_id   TEXT,
        metadata    TEXT,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_created_idx ON events (created_at);
      CREATE INDEX IF NOT EXISTS events_type_created_idx ON events (type, created_at);
      CREATE INDEX IF NOT EXISTS events_user_idx ON events (user_id, created_at);
    `,
  },
  {
    version: '0002_live_video',
    name: 'live provider columns',
    sql: `
      ALTER TABLE renders ADD COLUMN provider TEXT;
      ALTER TABLE renders ADD COLUMN provider_job_id TEXT;
      ALTER TABLE renders ADD COLUMN source_url TEXT;

      CREATE INDEX IF NOT EXISTS renders_provider_idx ON renders (provider);
      CREATE INDEX IF NOT EXISTS renders_provider_job_idx ON renders (provider_job_id);
    `,
  },
];
