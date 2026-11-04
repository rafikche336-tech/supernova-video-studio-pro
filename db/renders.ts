import type { ClipName, EngineId } from '@/lib/engines/registry';
import { isEngineId } from '@/lib/engines/registry';
import type { ProviderId } from '@/lib/render/types';
import { getDb } from './client';

export type RenderStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RenderRecord {
  readonly id: string;
  readonly userId: string;
  readonly engine: EngineId;
  readonly prompt: string;
  readonly status: RenderStatus;
  readonly progress: number;
  readonly clip: ClipName | null;
  readonly videoUrl: string | null;
  readonly posterUrl: string | null;
  readonly error: string | null;
  readonly durationMs: number | null;
  /** Which backend produced this render (`demo`, `fal`, `replicate`). */
  readonly provider: ProviderId | null;
  /** Backend-side job id, prefixed with the provider (`fal:abc123`). */
  readonly providerJobId: string | null;
  /** Original provider URL of the video, kept so media can be re-fetched. */
  readonly sourceUrl: string | null;
  readonly shareSlug: string | null;
  readonly sharedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface RenderRow {
  id: string;
  user_id: string;
  engine: string;
  prompt: string;
  status: string;
  progress: number;
  clip: string | null;
  video_url: string | null;
  poster_url: string | null;
  error: string | null;
  duration_ms: number | null;
  provider: string | null;
  provider_job_id: string | null;
  source_url: string | null;
  share_slug: string | null;
  shared_at: number | null;
  created_at: number;
  updated_at: number;
}

const STATUSES: readonly RenderStatus[] = ['queued', 'running', 'succeeded', 'failed'];

function toStatus(value: string): RenderStatus {
  return STATUSES.includes(value as RenderStatus) ? (value as RenderStatus) : 'failed';
}

function toRecord(row: RenderRow): RenderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    engine: isEngineId(row.engine) ? row.engine : 'wan',
    prompt: row.prompt,
    status: toStatus(row.status),
    progress: row.progress,
    clip: (row.clip as ClipName | null) ?? null,
    videoUrl: row.video_url,
    posterUrl: row.poster_url,
    error: row.error,
    durationMs: row.duration_ms,
    provider: (row.provider as ProviderId | null) ?? null,
    providerJobId: row.provider_job_id,
    sourceUrl: row.source_url,
    shareSlug: row.share_slug,
    sharedAt: row.shared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateRenderInput {
  readonly id: string;
  readonly userId: string;
  readonly engine: EngineId;
  readonly prompt: string;
  readonly status?: RenderStatus;
  readonly provider?: ProviderId | null;
  readonly providerJobId?: string | null;
}

export function createRender(input: CreateRenderInput): RenderRecord {
  const now = Date.now();
  const row: RenderRow = {
    id: input.id,
    user_id: input.userId,
    engine: input.engine,
    prompt: input.prompt,
    status: input.status ?? 'queued',
    progress: 0,
    clip: null,
    video_url: null,
    poster_url: null,
    error: null,
    duration_ms: null,
    provider: input.provider ?? null,
    provider_job_id: input.providerJobId ?? null,
    source_url: null,
    share_slug: null,
    shared_at: null,
    created_at: now,
    updated_at: now,
  };

  getDb()
    .prepare(
      `INSERT INTO renders
        (id, user_id, engine, prompt, status, progress, provider, provider_job_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.user_id,
      row.engine,
      row.prompt,
      row.status,
      row.progress,
      row.provider,
      row.provider_job_id,
      row.created_at,
      row.updated_at,
    );

  return toRecord(row);
}

export function getRenderById(id: string): RenderRecord | null {
  const row = getDb().prepare('SELECT * FROM renders WHERE id = ?').get(id) as RenderRow | undefined;
  return row ? toRecord(row) : null;
}

export function getRenderForUser(id: string, userId: string): RenderRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM renders WHERE id = ? AND user_id = ?')
    .get(id, userId) as RenderRow | undefined;
  return row ? toRecord(row) : null;
}

export function getRenderBySlug(slug: string): RenderRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM renders WHERE share_slug = ?')
    .get(slug) as RenderRow | undefined;
  return row ? toRecord(row) : null;
}

export interface RenderPatch {
  readonly status?: RenderStatus;
  readonly progress?: number;
  readonly clip?: ClipName | null;
  readonly videoUrl?: string | null;
  readonly posterUrl?: string | null;
  readonly error?: string | null;
  readonly durationMs?: number | null;
  readonly provider?: ProviderId | null;
  readonly providerJobId?: string | null;
  readonly sourceUrl?: string | null;
}

const COLUMN_FOR: Record<keyof RenderPatch, string> = {
  status: 'status',
  progress: 'progress',
  clip: 'clip',
  videoUrl: 'video_url',
  posterUrl: 'poster_url',
  error: 'error',
  durationMs: 'duration_ms',
  provider: 'provider',
  providerJobId: 'provider_job_id',
  sourceUrl: 'source_url',
};

export function updateRender(id: string, patch: RenderPatch): RenderRecord | null {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  for (const key of Object.keys(patch) as (keyof RenderPatch)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    assignments.push(`${COLUMN_FOR[key]} = ?`);
    values.push(value as string | number | null);
  }

  if (assignments.length === 0) {
    return getRenderById(id);
  }

  assignments.push('updated_at = ?');
  values.push(Date.now(), id);

  getDb()
    .prepare(`UPDATE renders SET ${assignments.join(', ')} WHERE id = ?`)
    .run(...values);

  return getRenderById(id);
}

export function setShareSlug(id: string, slug: string): RenderRecord | null {
  getDb()
    .prepare('UPDATE renders SET share_slug = ?, shared_at = ?, updated_at = ? WHERE id = ?')
    .run(slug, Date.now(), Date.now(), id);
  return getRenderById(id);
}

export interface ListRendersOptions {
  readonly userId: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly engine?: EngineId;
  readonly status?: RenderStatus;
  readonly search?: string;
}

export interface ListRendersResult {
  readonly items: RenderRecord[];
  readonly total: number;
}

export function listRenders(options: ListRendersOptions): ListRendersResult {
  const where: string[] = ['user_id = ?'];
  const params: (string | number)[] = [options.userId];

  if (options.engine) {
    where.push('engine = ?');
    params.push(options.engine);
  }
  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  if (options.search) {
    where.push('LOWER(prompt) LIKE ?');
    params.push(`%${options.search.toLowerCase()}%`);
  }

  const clause = where.join(' AND ');
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 60);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = getDb()
    .prepare(`SELECT * FROM renders WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as RenderRow[];

  const totalRow = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM renders WHERE ${clause}`)
    .get(...params) as { total: number };

  return { items: rows.map(toRecord), total: totalRow.total };
}

export function listRecentForUser(userId: string, limit = 6): RenderRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM renders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as RenderRow[];
  return rows.map(toRecord);
}

export function countRenders(userId?: string): number {
  const row = userId
    ? (getDb().prepare('SELECT COUNT(*) AS total FROM renders WHERE user_id = ?').get(userId) as {
        total: number;
      })
    : (getDb().prepare('SELECT COUNT(*) AS total FROM renders').get() as { total: number });
  return row.total;
}
