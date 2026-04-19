/** Pins older than this are hidden from the map (crowdsourced freshness). */
export const PIN_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // ~6 months

/** Minimum time between anonymous submissions per device (24h). */
export const SUBMISSION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Total reports on pins authored by a device → revoke posting. */
export const REPORTS_TO_REVOKE_POSTING = 5;

export function isPinExpired(createdAtIso: string, now = Date.now()): boolean {
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return true;
  return now - t > PIN_MAX_AGE_MS;
}
