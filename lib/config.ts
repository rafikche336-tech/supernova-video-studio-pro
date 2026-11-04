/**
 * Central constants. Keeping them here avoids "magic numbers" scattered across
 * the API routes, the client hooks and the tests.
 */

/** Longest prompt the API accepts (characters). */
export const MAX_PROMPT_LENGTH = 400;

/** Product copy + versioning (keep in sync with package.json). */
export const APP_NAME = 'Supernova Video Studio';
export const APP_VERSION = '2.0.0';

/** Render job lifetime in the in-memory store (10 minutes). */
export const JOB_TTL_MS = 10 * 60 * 1000;

/** Hard cap on stored jobs — protects the process from memory growth. */
export const MAX_JOBS = 500;

/** How long the demo provider pretends to work (milliseconds). */
export const MOCK_RENDER_DURATION_MS = 1500;

/** Client polling cadence and overall budget for a render. */
export const POLL_INTERVAL_MS = 350;
export const CLIENT_POLL_TIMEOUT_MS = 60_000;

/** Default request-rate budget per client. */
export const RATE_LIMIT_DEFAULTS = {
  capacity: 12,
  refillPerSecond: 0.2,
} as const;

/** Where the self-hosted demo clips live. */
export const MEDIA_PATH = '/media';
