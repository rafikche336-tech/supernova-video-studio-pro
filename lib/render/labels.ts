import type { ProviderId } from './types';

/**
 * Human-facing names for the render backends.
 *
 * Client-safe: pure data, no env access, no Node built-ins. The studio shows
 * these so a render always says who produced it — a demo clip is never passed
 * off as model output.
 */
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  demo: 'bundled clip (demo)',
  fal: 'fal.ai',
  replicate: 'Replicate',
};

/** Short form for badges and dense UI. */
export const PROVIDER_SHORT_LABELS: Record<ProviderId, string> = {
  demo: 'demo',
  fal: 'fal.ai',
  replicate: 'Replicate',
};

export function providerLabel(provider: ProviderId | null | undefined): string | null {
  return provider ? (PROVIDER_LABELS[provider] ?? null) : null;
}

export function providerShortLabel(provider: ProviderId | null | undefined): string | null {
  return provider ? (PROVIDER_SHORT_LABELS[provider] ?? null) : null;
}

/** One-line, honest description of what produced a finished render. */
export function renderSourceNote(provider: ProviderId | null | undefined): string | null {
  if (!provider) return null;
  if (provider === 'demo') {
    return 'Demo clip — no paid model was called, so this is a bundled video, not generated footage.';
  }
  return `Generated with ${PROVIDER_LABELS[provider]} from your prompt.`;
}
