import type { Env } from '@/lib/env';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ProviderId, RenderProvider } from '../types';
import { DemoRenderProvider } from './demo';
import { FalVideoProvider } from './fal';
import { ReplicateVideoProvider } from './replicate';
import { ProviderRouter } from './router';

/**
 * Turns configuration into a provider.
 *
 * Precedence (with `RENDER_PROVIDER=auto`, the default):
 *   1. fal.ai, when `FAL_KEY` is present
 *   2. Replicate, when `REPLICATE_API_TOKEN` is present
 *   3. the demo renderer, offline and free
 *
 * An explicit `fal`/`replicate` without its key does **not** throw: the app stays
 * usable and the reason is reported through the capability endpoint and the UI.
 */

export const DEFAULT_FAL_MODEL = 'fal-ai/ltx-2/text-to-video/fast';
export const DEFAULT_REPLICATE_MODEL = 'lightricks/ltx-video';
export { DemoRenderProvider } from './demo';
export { FalVideoProvider } from './fal';
export { ReplicateVideoProvider } from './replicate';
export { ProviderRouter } from './router';

export interface ProviderResolution {
  readonly router: ProviderRouter;
  /** What the operator asked for (`auto` unless configured otherwise). */
  readonly requested: Env['RENDER_PROVIDER'];
  /** Which backend jobs will actually use. */
  readonly activeId: ProviderId;
  readonly model?: string;
  /** Human-readable reason when the app is in demo mode. */
  readonly notice?: string;
}

export function resolveProviders(env: Env = getEnv()): ProviderResolution {
  const demo = new DemoRenderProvider();
  const requested = env.RENDER_PROVIDER;

  const falProvider = env.FAL_KEY
    ? new FalVideoProvider({
        apiKey: env.FAL_KEY,
        model: env.FAL_VIDEO_MODEL,
        baseUrl: env.FAL_API_BASE_URL,
        durationSeconds: env.VIDEO_DURATION_SECONDS,
        aspectRatio: env.VIDEO_ASPECT_RATIO,
      })
    : null;

  const replicateProvider = env.REPLICATE_API_TOKEN
    ? new ReplicateVideoProvider({
        apiToken: env.REPLICATE_API_TOKEN,
        model: env.REPLICATE_VIDEO_MODEL,
        baseUrl: env.REPLICATE_API_BASE_URL,
      })
    : null;

  const pick = (): { provider: RenderProvider | null; notice?: string } => {
    switch (requested) {
      case 'demo':
        return {
          provider: null,
          notice: 'RENDER_PROVIDER=demo — using the built-in demo renderer.',
        };

      case 'fal':
        return falProvider
          ? { provider: falProvider }
          : {
              provider: null,
              notice: 'RENDER_PROVIDER=fal but FAL_KEY is not set — using the demo renderer.',
            };

      case 'replicate':
        return replicateProvider
          ? { provider: replicateProvider }
          : {
              provider: null,
              notice:
                'RENDER_PROVIDER=replicate but REPLICATE_API_TOKEN is not set — using the demo renderer.',
            };

      default:
        if (falProvider) return { provider: falProvider };
        if (replicateProvider) return { provider: replicateProvider };
        return {
          provider: null,
          notice:
            'No video API key configured — using the built-in demo renderer. Set FAL_KEY (free credit) or REPLICATE_API_TOKEN to generate real video.',
        };
    }
  };

  const { provider, notice } = pick();
  const router = new ProviderRouter(provider, demo);

  if (notice) {
    logger.info(notice);
  } else if (provider) {
    logger.info('live video provider active', { provider: provider.id, model: provider.model });
  }

  return {
    router,
    requested,
    activeId: (provider?.id as ProviderId | undefined) ?? 'demo',
    model: provider?.model,
    notice,
  };
}
