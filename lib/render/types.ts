import type { EngineId } from '@/lib/engines/registry';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** `demo` = procedurally generated clips, `live` = a real inference backend. */
export type RenderMode = 'demo' | 'live';

export interface RenderJob {
  readonly id: string;
  readonly engine: EngineId;
  readonly prompt: string;
  readonly status: JobStatus;
  /** 0–100. */
  readonly progress: number;
  readonly videoUrl?: string;
  readonly posterUrl?: string;
  readonly videoAlt?: string;
  readonly error?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RenderInput {
  readonly prompt: string;
  readonly engine: EngineId;
}

/**
 * The seam between the studio and whatever actually produces video.
 *
 * Implement this interface to plug in a real model backend (see
 * `live-provider.ts`); the API routes and the UI need no changes.
 */
export interface RenderProvider {
  readonly mode: RenderMode;
  create(input: RenderInput): Promise<RenderJob>;
  get(id: string): Promise<RenderJob | null>;
}

export type RenderErrorCode = 'provider-not-configured' | 'provider-failed';

/** Typed error so routes can map failures onto HTTP status codes. */
export class RenderProviderError extends Error {
  readonly code: RenderErrorCode;
  readonly status: number;

  constructor(code: RenderErrorCode, message: string, status = 500) {
    super(message);
    this.name = 'RenderProviderError';
    this.code = code;
    this.status = status;
  }
}
