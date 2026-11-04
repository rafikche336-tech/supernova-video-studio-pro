import { logger } from '@/lib/logger';
import {
  RenderProviderError,
  splitProviderJobId,
  type PollContext,
  type ProviderJob,
  type RenderInput,
  type RenderMode,
  type RenderProvider,
} from '../types';

/**
 * Routes a render to the live backend and falls back to the demo renderer when
 * the backend cannot take the job (missing key, no credit, outage, timeout).
 *
 * The complex part is *polling*. Jobs are identified by a composite id
 * (`fal:abc123`), which is stored in the database, so:
 *
 *  - a job created before a restart can still be polled afterwards;
 *  - a database can hold a mix of live and demo renders without ambiguity;
 *  - the fallback path needs no extra bookkeeping — the demo submission simply
 *    returns a `demo:` id and later polls route back to the demo provider.
 */
export class ProviderRouter implements RenderProvider {
  readonly id = 'auto';
  readonly model?: string;

  private readonly primary: RenderProvider | null;
  private readonly demo: RenderProvider;

  constructor(primary: RenderProvider | null, demo: RenderProvider) {
    this.primary = primary;
    this.demo = demo;
    this.model = primary?.model;
  }

  get mode(): RenderMode {
    return this.primary ? 'live' : 'demo';
  }

  get primaryProvider(): RenderProvider | null {
    return this.primary;
  }

  async submit(input: RenderInput): Promise<ProviderJob> {
    if (!this.primary) {
      return this.demo.submit(input);
    }

    try {
      return await this.primary.submit(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.warn('live provider rejected the job; falling back to the demo renderer', {
        provider: this.primary.id,
        message,
      });

      // Deliberately swallow the error: the user gets a finished render (clearly
      // labelled as a demo clip) instead of a dead end. The reason is logged and
      // surfaced through the capability endpoint, not hidden in the UI.
      return this.demo.submit(input);
    }
  }

  async status(providerJobId: string, context: PollContext): Promise<ProviderJob | null> {
    const { provider } = splitProviderJobId(providerJobId);

    if (provider === 'demo') {
      return this.demo.status(providerJobId, context);
    }

    if (this.primary && provider === this.primary.id) {
      return this.primary.status(providerJobId, context);
    }

    throw new RenderProviderError(
      'provider-not-configured',
      `This render was created with the "${provider}" provider, which is not configured right now. Add its API key to resume polling.`,
      501,
      false,
    );
  }
}
