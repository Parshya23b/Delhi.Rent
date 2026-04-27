/**
 * Simple in-memory sliding-window rate limiter per IP.
 * Best-effort only (multi-instance Edge deployments do not share memory).
 */

type Bucket = { windowStart: number; count: number };

const store = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Max requests allowed in the window */
  max: number;
  /** Window length in ms */
  windowMs: number;
};

const DEFAULT_OPTS: RateLimitOptions = {
  max: 30,
  windowMs: 60 * 60 * 1000,
};

export function checkRateLimit(ip: string, opts: Partial<RateLimitOptions> = {}): { ok: boolean; retryAfterMs?: number } {
  const { max, windowMs } = { ...DEFAULT_OPTS, ...opts };
  const now = Date.now();
  const key = ip || "unknown";
  let b = store.get(key);
  if (!b || now - b.windowStart > windowMs) {
    b = { windowStart: now, count: 0 };
    store.set(key, b);
  }
  if (b.count >= max) {
    const retryAfterMs = windowMs - (now - b.windowStart);
    return { ok: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }
  b.count += 1;
  return { ok: true };
}
