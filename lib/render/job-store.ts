interface StoredEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface TtlStoreOptions {
  readonly ttlMs: number;
  readonly maxEntries: number;
}

/**
 * A tiny in-memory map with per-entry expiry and a hard size cap.
 *
 * This is deliberately boring: it is correct for a single process, which is
 * what the demo needs. **A multi-instance deployment must swap this for Redis
 * or a database** — jobs created on instance A are invisible to instance B.
 * See docs/ARCHITECTURE.md § Scaling.
 */
export class TtlStore<T> {
  private readonly entries = new Map<string, StoredEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: TtlStoreOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    this.prune(now);

    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      // Map preserves insertion order, so the first key is the oldest.
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }

    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
  }

  get(key: string, now: number = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
