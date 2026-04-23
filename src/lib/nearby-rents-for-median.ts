import { median } from "@/lib/geo";
import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import { entriesNearPoint } from "@/lib/rent-engine";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { PIN_MAX_AGE_MS } from "@/lib/rent-policy";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Collect rent_inr values near a point for outlier validation from `rent_entries`. */
export async function collectNearbyRentAmountsForMedian(
  lat: number,
  lng: number,
  bhk: string,
  supabase: SupabaseClient | null,
): Promise<number[]> {
  if (!supabase) return [];

  const since = new Date(Date.now() - PIN_MAX_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from(RENT_ENTRIES_EXPANDED)
    .select("*")
    .gte("created_at", since);

  if (error || !data?.length) return [];

  const rows = data.map((r) => normalizeRentRow(r as Record<string, unknown>));
  return entriesNearPoint(lat, lng, rows, 3, bhk).map((e) => e.rent_inr);
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
