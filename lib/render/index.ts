import { getEnv } from '@/lib/env';
import { resolveProviders, type ProviderResolution } from './providers';
import type { RenderProvider } from './types';

export * from './types';
export { resolveProviders, DEFAULT_FAL_MODEL, DEFAULT_REPLICATE_MODEL } from './providers';
export { DemoRenderProvider } from './providers/demo';
export { FalVideoProvider } from './providers/fal';
export { ReplicateVideoProvider } from './providers/replicate';
export { ProviderRouter } from './providers/router';
export type { ProviderResolution } from './providers';
export type { FalProviderConfig } from './providers/fal';
export type { ReplicateProviderConfig } from './providers/replicate';

let cached: ProviderResolution | null = null;

/**
 * Resolves (and memoises) the configured provider chain.
 *
 * The chain is: live provider (fal or Replicate) → demo renderer. The router
 * decides per job, so a live outage degrades to a demo clip instead of an error.
 */
export function getProviderResolution(): ProviderResolution {
  cached ??= resolveProviders(getEnv());
  return cached;
}

/** The provider the routes talk to. */
export function getRenderProvider(): RenderProvider {
  return getProviderResolution().router;
}

/** Test helper — forget the memoised provider. */
export function resetRenderProvider(): void {
  cached = null;
}
