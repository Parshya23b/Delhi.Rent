import { SUBMISSION_COOLDOWN_MS } from "@/lib/rent-policy";

const lastPostAt = new Map<string, number>();

/** One submission per device per 24h (in-memory fallback when DB unavailable). */
export function recordSubmission(deviceHash: string): void {
  lastPostAt.set(deviceHash, Date.now());
}

export function checkCooldownMemory(deviceHash: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const prev = lastPostAt.get(deviceHash);
  if (prev == null) return { ok: true };
  const elapsed = Date.now() - prev;
  if (elapsed >= SUBMISSION_COOLDOWN_MS) return { ok: true };
  const retryAfterSec = Math.ceil((SUBMISSION_COOLDOWN_MS - elapsed) / 1000);
  return { ok: false, retryAfterSec };
}
