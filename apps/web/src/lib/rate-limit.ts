type Entry = { count: number; resetAt: number };

/**
 * In-memory fixed-window limiter. Fine for a single instance; swap for Redis when scaling out.
 * Expired entries are swept once the map grows past `maxKeys`, so random keys cannot exhaust memory.
 */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, Entry>();

  function sweep(now: number) {
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    // Still too big (every key is live): drop the oldest ones, which Map keeps in insertion order.
    for (const key of hits.keys()) {
      if (hits.size < maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) sweep(now);
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterMs: 0 };
      }
      entry.count += 1;
      if (entry.count > limit) return { allowed: false, retryAfterMs: entry.resetAt - now };
      return { allowed: true, retryAfterMs: 0 };
    },
    reset(key: string) {
      hits.delete(key);
    },
    size() {
      return hits.size;
    },
  };
}
