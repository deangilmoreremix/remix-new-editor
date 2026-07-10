// effects-cache — LRU cache with prefetch (ported from upstream
// `effects-cache.ts`). Used by the timeline to keep effect thumbnails / frame
// previews hot. Pure client-side, no backend.

interface Entry<T> {
  value: T;
  expires: number;
}

export class EffectsCache<T = unknown> {
  private store = new Map<string, Entry<T>>();
  constructor(
    private capacity = 200,
    private ttlMs = 5 * 60 * 1000,
  ) {}

  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // LRU touch
    this.store.delete(key);
    this.store.set(key, e);
    return e.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.store.size > this.capacity) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Warm the cache with a producer for keys likely to be needed soon. */
  async prefetch(keys: string[], producer: (key: string) => Promise<T>): Promise<void> {
    await Promise.all(
      keys.map(async (k) => {
        if (!this.has(k)) {
          try {
            this.set(k, await producer(k));
          } catch {
            /* prefetch failures are non-fatal */
          }
        }
      }),
    );
  }

  clear(): void {
    this.store.clear();
  }

  stats() {
    return { size: this.store.size, capacity: this.capacity };
  }
}

export const effectsCache = new EffectsCache();
