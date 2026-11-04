import { RATE_LIMIT_DEFAULTS } from '@/lib/config';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitOptions {
  readonly capacity: number;
  readonly refillPerSecond: number;
  /** Injectable clock — makes the limiter testable without timers. */
  readonly now: number;
}

export interface RateLimitResult {
  readonly ok: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

/**
 * Hard cap on tracked clients. The map is cleared when exceeded, which trades a
 * little accuracy under a distributed flood for bounded memory.
 */
const MAX_TRACKED_CLIENTS = 10_000;

const buckets = new Map<string, Bucket>();

/**
 * Token-bucket limiter, keyed by client.
 *
 * In-process only: with N instances a client effectively gets N × capacity.
 * Put a shared limiter (Upstash, Redis, the platform's WAF) in front before you
 * attach a paid model to this endpoint.
 */
export function checkRateLimit(
  key: string,
  options: Partial<RateLimitOptions> = {},
): RateLimitResult {
  const capacity = options.capacity ?? RATE_LIMIT_DEFAULTS.capacity;
  const refillPerSecond = options.refillPerSecond ?? RATE_LIMIT_DEFAULTS.refillPerSecond;
  const now = options.now ?? Date.now();

  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_TRACKED_CLIENTS) {
      buckets.clear();
    }
    bucket = { tokens: capacity, updatedAt: now };
    buckets.set(key, bucket);
  }

  const elapsedSeconds = Math.max((now - bucket.updatedAt) / 1000, 0);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(deficit / refillPerSecond)),
    };
  }

  bucket.tokens -= 1;

  return {
    ok: true,
    remaining: Math.floor(bucket.tokens),
    retryAfterSeconds: 0,
  };
}

/** Test helper. */
export function resetRateLimit(): void {
  buckets.clear();
}
