// Simple in-memory sliding-window rate limiter (no external dependencies).
// Keyed by identifier (e.g., user email) so each user gets their own window.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean old entries every 5 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(store.keys());
  for (const key of keys) {
    const entry = store.get(key)!;
    entry.timestamps = entry.timestamps.filter((t: number) => now - t < 600_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300_000);

/**
 * Check whether a request should be rate-limited.
 *
 * @param identifier  Unique key, typically `${route}:${userEmail}`
 * @param maxRequests Maximum requests allowed inside the window
 * @param windowMs    Sliding window duration in milliseconds (default 60 s)
 * @returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`
 */
export function rateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 60_000
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(identifier);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}
