import { generateDummyRents } from "@/lib/dummy-rents";
import { median } from "@/lib/geo";
import { entriesNearPoint } from "@/lib/rent-engine";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { isPinExpired, PIN_MAX_AGE_MS } from "@/lib/rent-policy";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Collect rent_inr values near a point for outlier validation (dummy + DB, not expired). */
export async function collectNearbyRentAmountsForMedian(
  lat: number,
  lng: number,
  bhk: string,
  supabase: SupabaseClient | null,
): Promise<number[]> {
  const dummy = generateDummyRents().filter((e) => !isPinExpired(e.created_at));
  const fromDummy = entriesNearPoint(lat, lng, dummy, 3, bhk).map((e) => e.rent_inr);

  if (!supabase) return fromDummy;

  const since = new Date(Date.now() - PIN_MAX_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from("rent_entries")
    .select("*")
    .gte("created_at", since);

  if (error || !data?.length) return fromDummy;

  const rows = data.map((r) => normalizeRentRow(r as Record<string, unknown>));
  const fromDb = entriesNearPoint(lat, lng, rows, 3, bhk).map((e) => e.rent_inr);

  return [...fromDummy, ...fromDb];
}

export function validateRentAgainstRegionalMedian(
  rent_inr: number,
  nearbyAmounts: number[],
): { ok: true } | { ok: false; message: string } {
  if (nearbyAmounts.length < 3) return { ok: true };
  const med = median(nearbyAmounts);
  if (med <= 0) return { ok: true };
  const strict = nearbyAmounts.length >= 5;
  const low = strict ? med / 5 : med / 4;
  const high = strict ? med * 5 : med * 4;
  if (rent_inr < low || rent_inr > high) {
    return {
      ok: false,
      message:
        "This rent looks very different from other reports nearby. Please double-check the amount and location.",
    };
  }
  return { ok: true };
}
