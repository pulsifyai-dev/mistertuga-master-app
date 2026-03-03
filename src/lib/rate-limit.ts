/**
 * Simple in-memory rate limiter for Server Actions.
 * Uses a Map with TTL-based sliding window per key.
 *
 * NOTE: This is per-process. In a multi-instance deployment (e.g. Vercel),
 * each serverless function instance has its own Map. For stricter guarantees,
 * use Redis or Upstash. This is sufficient for basic abuse prevention.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Check and consume a rate limit token.
 *
 * @param key - Unique identifier (e.g. userId + actionName)
 * @param limit - Max requests per window (default: 10)
 * @param windowMs - Window duration in ms (default: 60000 = 1 minute)
 * @returns Object with `success` (allowed?) and `remaining` tokens
 */
export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { success: boolean; remaining: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}
