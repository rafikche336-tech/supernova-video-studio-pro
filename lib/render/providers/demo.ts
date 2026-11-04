import { JOB_TTL_MS, MAX_JOBS, MOCK_RENDER_DURATION_MS } from '@/lib/config';
import { pickClip } from '@/lib/engines/pick-clip';
import { getClip } from '@/lib/engines/registry';
import type { EngineId } from '@/lib/engines/registry';
import { TtlStore } from '../job-store';
import {
  makeProviderJobId,
  type JobStatus,
  type PollContext,
  type ProviderJob,
  type RenderInput,
  type RenderProvider,
} from '../types';

interface DemoRecord {
  readonly id: string;
  readonly engine: EngineId;
  readonly prompt: string;
  readonly startedAt: number;
  readonly durationMs: number;
}

/** How long a job reports `queued` before flipping to `running`. */
const QUEUED_WINDOW_MS = 200;

/**
 * Demo provider: simulates a job lifecycle and returns a self-hosted,
 * procedurally generated clip.
 *
 * Two jobs:
 *  1. Zero-setup demo — the product is fully usable with no API key.
 *  2. Automatic fallback — if the live provider is down, out of credit or
 *     misconfigured, the router falls back here so a render still completes.
 *
 * It is honest about what it is: the row's `provider` is `demo`, the API reports
 * it, and the UI labels the result.
 */
export class DemoRenderProvider implements RenderProvider {
  readonly id = 'demo';
  readonly mode = 'demo' as const;
  readonly model = 'bundled-clips';

  private readonly store: TtlStore<DemoRecord>;
  private readonly baseDurationMs: number;

  constructor(options: { durationMs?: number } = {}) {
    this.store = new TtlStore<DemoRecord>({ ttlMs: JOB_TTL_MS, maxEntries: MAX_JOBS });
    this.baseDurationMs = options.durationMs ?? MOCK_RENDER_DURATION_MS;
  }

  async submit({ prompt, engine }: RenderInput): Promise<ProviderJob> {
    const now = Date.now();
    const record: DemoRecord = {
      id: globalThis.crypto.randomUUID(),
      engine,
      prompt,
      startedAt: now,
      // Slightly longer prompts "take longer", so the progress bar feels real.
      durationMs: this.baseDurationMs + Math.min(prompt.length * 3, 600),
    };

    this.store.set(record.id, record, now);
    return toProviderJob(record, now);
  }

  async status(providerJobId: string, context: PollContext): Promise<ProviderJob | null> {
    const id = providerJobId.startsWith('demo:')
      ? providerJobId.slice('demo:'.length)
      : providerJobId;
    const record = this.store.get(id);
    if (!record) return null;

    // The caller's clock (the database row's creation time) wins over the
    // in-memory one: progress then stays consistent across a restart or a slow
    // request, and tests can control time by moving the row.
    const startedAt = Number.isFinite(context.submittedAt) ? context.submittedAt : record.startedAt;

    return toProviderJob({ ...record, startedAt }, Date.now());
  }
}

function toProviderJob(record: DemoRecord, now: number): ProviderJob {
  const elapsed = Math.max(now - record.startedAt, 0);
  const ratio = Math.min(elapsed / record.durationMs, 1);

  const status: JobStatus =
    ratio >= 1 ? 'succeeded' : elapsed < QUEUED_WINDOW_MS ? 'queued' : 'running';

  const base = {
    providerJobId: makeProviderJobId('demo', record.id),
    status,
    progress: Math.round(ratio * 100),
  } satisfies ProviderJob;

  if (status !== 'succeeded') {
    return base;
  }

  const clip = pickClip(record.prompt, record.engine);
  const asset = getClip(clip);

  return {
    ...base,
    clip,
    progress: 100,
    videoUrl: asset.src,
    posterUrl: asset.poster,
    videoAlt: asset.alt,
  };
}
