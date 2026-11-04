import {
  RenderProviderError,
  type RenderInput,
  type RenderJob,
  type RenderMode,
  type RenderProvider,
} from './types';

export interface LiveProviderConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
}

/**
 * Placeholder for a real inference backend.
 *
 * It deliberately **fails loudly** instead of pretending to work: if
 * `RENDER_PROVIDER=live` is set without an implementation, callers get a 501
 * and a clear message rather than a stock clip masquerading as model output.
 *
 * To implement, keep the `RenderProvider` contract and:
 *
 *  1. `create()` — POST `{ prompt, engine }` to your backend (Replicate, fal.ai,
 *     RunPod, a self-hosted GPU worker…), store the returned provider-side job
 *     id, and return a `RenderJob` with `status: 'queued'`.
 *  2. `get()` — poll the provider, map its states onto `JobStatus`, and once
 *     ready return the signed media URL in `videoUrl` (plus `posterUrl`).
 *  3. Store correlation data in a durable store (Redis/Postgres), not the
 *     in-memory `TtlStore`, or jobs vanish between requests/instances.
 *  4. Add rate limiting and cost controls before exposing it publicly.
 *
 * The routes and the UI already handle `queued`/`running`/`succeeded`/`failed`
 * and surface `error` messages, so no client changes are needed.
 */
export class LiveRenderProvider implements RenderProvider {
  readonly mode: RenderMode = 'live';

  private readonly config: LiveProviderConfig;

  constructor(config: LiveProviderConfig) {
    this.config = config;
  }

  async create(_input: RenderInput): Promise<RenderJob> {
    throw new RenderProviderError(
      'provider-not-configured',
      'Live rendering is not implemented yet. Set RENDER_PROVIDER=demo, or implement LiveRenderProvider.create() — see docs/ARCHITECTURE.md.',
      501,
    );
  }

  async get(_id: string): Promise<RenderJob | null> {
    // Nothing is ever created while create() throws, so there is nothing to poll.
    void this.config;
    return null;
  }
}
