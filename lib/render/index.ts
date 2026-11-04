import { getEnv } from '@/lib/env';
import { LiveRenderProvider } from './live-provider';
import { MockRenderProvider } from './mock-provider';
import { RenderProviderError, type RenderProvider } from './types';

export * from './types';
export { MockRenderProvider } from './mock-provider';

let cached: RenderProvider | null = null;

/**
 * Returns the configured provider (memoised per process).
 *
 * Throws `RenderProviderError` when live mode is requested without the config
 * it needs — routes translate that into a 501 rather than faking success.
 */
export function getRenderProvider(): RenderProvider {
  if (cached) return cached;

  const env = getEnv();

  if (env.RENDER_PROVIDER === 'live') {
    if (!env.RENDER_API_URL || !env.RENDER_API_KEY) {
      throw new RenderProviderError(
        'provider-not-configured',
        'RENDER_PROVIDER=live requires RENDER_API_URL and RENDER_API_KEY.',
        501,
      );
    }
    cached = new LiveRenderProvider({ apiUrl: env.RENDER_API_URL, apiKey: env.RENDER_API_KEY });
    return cached;
  }

  cached = new MockRenderProvider();
  return cached;
}

/** Test helper — forget the memoised provider. */
export function resetRenderProvider(): void {
  cached = null;
}
