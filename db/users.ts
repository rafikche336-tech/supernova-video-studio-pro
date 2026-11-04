import { getDb } from './client';

export type UserProvider = 'github' | 'guest';

export interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly image: string | null;
  readonly provider: UserProvider;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  provider: string;
  created_at: number;
  updated_at: number;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    provider: row.provider === 'github' ? 'github' : 'guest',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const GUEST_NAMES = ['Nova', 'Orbit', 'Comet', 'Pulsar', 'Quasar', 'Nebula', 'Vega', 'Rigel'];

const SELECT_USER = 'SELECT * FROM users WHERE id = ?';

export function getUserById(id: string): UserRecord | null {
  const row = getDb().prepare(SELECT_USER).get(id) as UserRow | undefined;
  return row ? toRecord(row) : null;
}

export function getUserByEmail(email: string): UserRecord | null {
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  return row ? toRecord(row) : null;
}

export interface UpsertUserInput {
  readonly name: string;
  readonly email: string | null;
  readonly image: string | null;
  readonly provider: UserProvider;
}

/**
 * Creates or refreshes an OAuth user. Email is the identity key for GitHub so a
 * returning visitor keeps their history.
 */
export function upsertUser(input: UpsertUserInput): UserRecord {
  const db = getDb();
  const now = Date.now();
  const existing = input.email ? getUserByEmail(input.email) : null;

  if (existing) {
    db.prepare('UPDATE users SET name = ?, image = ?, provider = ?, updated_at = ? WHERE id = ?').run(
      input.name,
      input.image,
      input.provider,
      now,
      existing.id,
    );
    return { ...existing, name: input.name, image: input.image, provider: input.provider, updatedAt: now };
  }

  const record: UserRow = {
    id: globalThis.crypto.randomUUID(),
    name: input.name,
    email: input.email,
    image: input.image,
    provider: input.provider,
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    'INSERT INTO users (id, name, email, image, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    record.id,
    record.name,
    record.email,
    record.image,
    record.provider,
    record.created_at,
    record.updated_at,
  );

  return toRecord(record);
}

/** Ephemeral account for "continue as guest" — no email, random display name. */
export function createGuestUser(): UserRecord {
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  const base = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)] ?? 'Nova';
  return upsertUser({
    name: `${base} ${suffix}`,
    email: null,
    image: null,
    provider: 'guest',
  });
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number };
  return row.total;
}

/** Housekeeping: drop guest accounts that never came back. */
export function pruneStaleGuests(maxAgeMs: number): number {
  const cutoff = Date.now() - maxAgeMs;
  const result = getDb()
    .prepare("DELETE FROM users WHERE provider = 'guest' AND updated_at < ?")
    .run(cutoff);
  return result.changes;
}
