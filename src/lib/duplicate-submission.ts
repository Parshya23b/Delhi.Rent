import type { SupabaseClient } from "@supabase/supabase-js";

/** ~13m in degrees at Delhi lat — “same pin” for spam detection */
const DUPLICATE_EPS = 0.00012;
const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

const recentPins: { hash: string; lat: number; lng: number; at: number }[] = [];
const RECENT_CAP = 400;

function trimRecent(): void {
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
  while (recentPins.length && recentPins[0].at < cutoff) {
    recentPins.shift();
  }
}

/** In-memory duplicate check when Supabase is off (local-only submissions). */
export function hasRecentDuplicateMemory(
  deviceHash: string,
  lat: number,
  lng: number,
): boolean {
  trimRecent();
  const now = Date.now();
  return recentPins.some(
    (p) =>
      p.hash === deviceHash &&
      now - p.at < DUPLICATE_WINDOW_MS &&
      Math.abs(p.lat - lat) < DUPLICATE_EPS &&
      Math.abs(p.lng - lng) < DUPLICATE_EPS,
  );
}

export function recordSubmittedPinMemory(
  deviceHash: string,
  lat: number,
  lng: number,
): void {
  recentPins.push({ hash: deviceHash, lat, lng, at: Date.now() });
  trimRecent();
  while (recentPins.length > RECENT_CAP) recentPins.shift();
}

export async function hasRecentDuplicateInSupabase(
  supabase: SupabaseClient,
  deviceHash: string,
  lat: number,
  lng: number,
): Promise<boolean> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("rent_entries")
    .select("id")
    .eq("device_id_hash", deviceHash)
    .gte("created_at", since)
    .gte("lat", lat - DUPLICATE_EPS)
    .lte("lat", lat + DUPLICATE_EPS)
    .gte("lng", lng - DUPLICATE_EPS)
    .lte("lng", lng + DUPLICATE_EPS)
    .limit(1);

  if (error) {
    console.warn("[duplicate check]", error.message);
    return false;
  }
  return Boolean(data?.length);
}
