import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('allows a burst up to capacity, then blocks', () => {
    const now = 1_000_000;
    const options = { capacity: 3, refillPerSecond: 0.1, now };

    expect(checkRateLimit('client-a', options).ok).toBe(true);
    expect(checkRateLimit('client-a', options).ok).toBe(true);
    expect(checkRateLimit('client-a', options).ok).toBe(true);

    const blocked = checkRateLimit('client-a', options);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('refills over time', () => {
    const base = { capacity: 1, refillPerSecond: 1 };

    expect(checkRateLimit('client-b', { ...base, now: 0 }).ok).toBe(true);
    expect(checkRateLimit('client-b', { ...base, now: 0 }).ok).toBe(false);
    // One second later a token is available again.
    expect(checkRateLimit('client-b', { ...base, now: 1000 }).ok).toBe(true);
  });

  it('does not let one client starve another', () => {
    const base = { capacity: 1, refillPerSecond: 0.1, now: 0 };

    expect(checkRateLimit('client-c', base).ok).toBe(true);
    expect(checkRateLimit('client-c', base).ok).toBe(false);
    expect(checkRateLimit('client-d', base).ok).toBe(true);
  });

  it('never reports a fractional remaining count', () => {
    const result = checkRateLimit('client-e', {
      capacity: 5,
      refillPerSecond: 0.5,
      now: 0,
    });

    expect(Number.isInteger(result.remaining)).toBe(true);
  });
});
