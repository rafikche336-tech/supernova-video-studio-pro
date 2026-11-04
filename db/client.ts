import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { migrations } from './migrations.mjs';

/**
 * SQLite access layer.
 *
 * Why not Prisma? Prisma's query/schema engines are fetched from
 * `binaries.prisma.sh` at install and generate time, which is not reachable in
 * the environment this project is built and verified in. `better-sqlite3` is a
 * prebuilt native binding with no network dependency, so it works offline and in
 * CI. The access layer is deliberately thin and dialect-neutral SQL so a
 * Postgres driver can replace it — see docs/ARCHITECTURE.md.
 */

export type Db = Database.Database;

let instance: Db | null = null;

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH ?? 'data/supernova.db';
  if (configured === ':memory:') return configured;
  // The database is a runtime artefact, never a build input: tell the bundler
  // not to trace it (otherwise the whole project is traced into the output).
  return isAbsolute(configured) ? configured : join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function applyMigrations(db: Db): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  );

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(
      (row) => row.version,
    ),
  );

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
}

export function openDatabase(path: string = resolveDatabasePath()): Db {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  applyMigrations(db);
  return db;
}

/** Lazily opened, process-wide connection. */
export function getDb(): Db {
  instance ??= openDatabase();
  return instance;
}

/** Test seam — pass `null` to force the next `getDb()` to reconnect. */
export function setDbForTests(db: Db | null): void {
  instance = db;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}

export function nowMs(): number {
  return Date.now();
}
