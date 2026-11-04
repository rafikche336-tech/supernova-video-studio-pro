import { getDb } from './client';

export type EventType =
  | 'sign_in'
  | 'render_started'
  | 'render_succeeded'
  | 'render_failed'
  | 'download'
  | 'share';

export interface RecordEventInput {
  readonly type: EventType;
  readonly userId?: string | null;
  readonly renderId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Append-only activity log. Powers the analytics dashboard and keeps the
 * `renders` table focused on current state.
 */
export function recordEvent(input: RecordEventInput): void {
  getDb()
    .prepare(
      'INSERT INTO events (id, user_id, type, render_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      globalThis.crypto.randomUUID(),
      input.userId ?? null,
      input.type,
      input.renderId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      Date.now(),
    );
}

export function countEvents(type: EventType, options: { userId?: string; since?: number } = {}): number {
  const where = ['type = ?'];
  const params: (string | number)[] = [type];

  if (options.userId) {
    where.push('user_id = ?');
    params.push(options.userId);
  }
  if (options.since !== undefined) {
    where.push('created_at >= ?');
    params.push(options.since);
  }

  const row = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM events WHERE ${where.join(' AND ')}`)
    .get(...params) as { total: number };

  return row.total;
}
