import { JOB_TTL_MS, MAX_JOBS, MOCK_RENDER_DURATION_MS } from '@/lib/config';
import { pickClipAsset } from '@/lib/engines/pick-clip';
import type { EngineId } from '@/lib/engines/registry';
import { TtlStore } from './job-store';
import type { JobStatus, RenderInput, RenderJob, RenderMode, RenderProvider } from './types';

interface MockRecord {
  readonly id: string;
  readonly engine: EngineId;
  readonly prompt: string;
  readonly startedAt: number;
  readonly durationMs: number;
}

/** How long a job reports `queued` before flipping to `running`. */
const QUEUED_WINDOW_MS = 200;

/**
 * Demo provider: simulates a render job lifecycle and returns a self-hosted,
 * procedurally generated clip.
 *
 * It is honest about what it is — the API reports `mode: "demo"` and the UI
 * shows a demo banner — and it implements the *real* job shape (queue →
 * running → succeeded), so swapping in a model backend changes nothing for the
 * client.
 */
export class MockRenderProvider implements RenderProvider {
  readonly mode: RenderMode = 'demo';

  private readonly store: TtlStore<MockRecord>;
  private readonly baseDurationMs: number;

  constructor(options: { durationMs?: number } = {}) {
    this.store = new TtlStore<MockRecord>({ ttlMs: JOB_TTL_MS, maxEntries: MAX_JOBS });
    this.baseDurationMs = options.durationMs ?? MOCK_RENDER_DURATION_MS;
  }

  async create({ prompt, engine }: RenderInput): Promise<RenderJob> {
    const now = Date.now();
    const record: MockRecord = {
      id: globalThis.crypto.randomUUID(),
      engine,
      prompt,
      startedAt: now,
      // Slightly longer prompts "take longer", so the progress bar feels real.
      durationMs: this.baseDurationMs + Math.min(prompt.length * 3, 600),
    };

    this.store.set(record.id, record, now);
    return toRenderJob(record, now);
  }

  async get(id: string): Promise<RenderJob | null> {
    const record = this.store.get(id);
    return record ? toRenderJob(record, Date.now()) : null;
  }
}

function toRenderJob(record: MockRecord, now: number): RenderJob {
  const elapsed = Math.max(now - record.startedAt, 0);
  const ratio = Math.min(elapsed / record.durationMs, 1);

  const status: JobStatus =
    ratio >= 1 ? 'succeeded' : elapsed < QUEUED_WINDOW_MS ? 'queued' : 'running';

  const base = {
    id: record.id,
    engine: record.engine,
    prompt: record.prompt,
    status,
    progress: Math.round(ratio * 100),
    createdAt: new Date(record.startedAt).toISOString(),
    updatedAt: new Date(now).toISOString(),
  } satisfies RenderJob;

  if (status !== 'succeeded') {
    return base;
  }

  const asset = pickClipAsset(record.prompt, record.engine);

  return {
    ...base,
    progress: 100,
    videoUrl: asset.src,
    posterUrl: asset.poster,
    videoAlt: asset.alt,
  };
}
