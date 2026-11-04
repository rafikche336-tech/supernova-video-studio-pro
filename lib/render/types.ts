import type { ClipName, EngineId } from '@/lib/engines/registry';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** `demo` = procedurally generated clips, `live` = a real inference backend. */
export type RenderMode = 'demo' | 'live';

/** Concrete backends. `demo` is the offline fallback. */
export type ProviderId = 'demo' | 'fal' | 'replicate';

export interface RenderJob {
  readonly id: string;
  readonly engine: EngineId;
  readonly prompt: string;
  readonly status: JobStatus;
  /** 0–100. */
  readonly progress: number;
  /** Which generated clip backs this job (demo mode / fallback poster). */
  readonly clip?: ClipName;
  readonly videoUrl?: string;
  readonly posterUrl?: string;
  readonly videoAlt?: string;
  readonly error?: string;
  /** Which backend actually produced (or will produce) this job. */
  readonly provider?: ProviderId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RenderInput {
  readonly prompt: string;
  readonly engine: EngineId;
}

/**
 * One job as the *backend* sees it.
 *
 * `providerJobId` is prefixed with the provider id (`fal:abc123`) so the router
 * knows which backend to poll even after a restart — no in-memory mapping to
 * lose, no assumptions about process lifetime.
 */
export interface ProviderJob {
  readonly providerJobId: string;
  readonly status: JobStatus;
  readonly progress: number;
  /** Demo only: which bundled clip was chosen. */
  readonly clip?: ClipName;
  /** Remote URL from the provider, or a `/media/...` path in demo mode. */
  readonly videoUrl?: string;
  readonly posterUrl?: string;
  readonly videoAlt?: string;
  readonly error?: string;
}

export interface PollContext {
  /** When the job was submitted (epoch ms) — used for progress heuristics. */
  readonly submittedAt: number;
}

/**
 * The seam between the studio and whatever actually produces video.
 *
 * Implementations must be stateless with respect to job ids: everything needed
 * to poll a job is the `providerJobId` string, because serverless functions and
 * restarts lose memory between requests.
 */
export interface RenderProvider {
  readonly id: ProviderId | 'auto';
  readonly mode: RenderMode;
  /** Model identifier shown in the UI and the API capability document. */
  readonly model?: string;
  submit(input: RenderInput): Promise<ProviderJob>;
  status(providerJobId: string, context: PollContext): Promise<ProviderJob | null>;
}

export type RenderErrorCode =
  | 'provider-not-configured'
  | 'provider-failed'
  | 'provider-auth'
  | 'provider-rate-limited';

/** Typed error so routes can map failures onto HTTP status codes. */
export class RenderProviderError extends Error {
  readonly code: RenderErrorCode;
  readonly status: number;
  /** Whether falling back to the demo renderer is a sensible response. */
  readonly recoverable: boolean;

  constructor(code: RenderErrorCode, message: string, status = 500, recoverable = true) {
    super(message);
    this.name = 'RenderProviderError';
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

/** Splits a composite `providerJobId` into provider id and native job id. */
export function splitProviderJobId(value: string): { provider: string; id: string } {
  const separator = value.indexOf(':');
  if (separator === -1) return { provider: 'unknown', id: value };
  return { provider: value.slice(0, separator), id: value.slice(separator + 1) };
}

export function makeProviderJobId(provider: ProviderId, id: string): string {
  return `${provider}:${id}`;
}
