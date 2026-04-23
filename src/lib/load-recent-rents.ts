import { normalizeRentRow } from "@/lib/rent-mapper";
import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import { PIN_MAX_AGE_MS } from "@/lib/rent-policy";
import { getSupabaseRead } from "@/lib/supabase/service";
import type { RentEntry } from "@/types/rent";

export type RentBbox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function sortEntriesByRecentFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Rent pins for the map from Supabase `rent_entries` only. */
export async function loadRecentRentEntries(opts?: {
  bbox?: RentBbox | null;
}): Promise<RentEntry[]> {
  const bbox = opts?.bbox ?? null;
  const rows: RentEntry[] = [];

  const supabase = getSupabaseRead();
  if (!supabase) {
    return sortEntriesByRecentFirst(rows);
  }

  const sinceIso = new Date(Date.now() - PIN_MAX_AGE_MS).toISOString();

  if (bbox) {
    const rpc = await supabase.rpc("rents_in_bbox", {
      min_lng: bbox.minLng,
      min_lat: bbox.minLat,
      max_lng: bbox.maxLng,
      max_lat: bbox.maxLat,
      since_iso: sinceIso,
    });

    if (!rpc.error && rpc.data?.length) {
      const seen = new Set(rows.map((x) => x.id));
      for (const r of rpc.data as Record<string, unknown>[]) {
        const m = normalizeRentRow(r);
        if (!seen.has(m.id)) {
          seen.add(m.id);
          rows.push(m);
        }
      }
      return sortEntriesByRecentFirst(rows);
    }

    if (rpc.error) {
      console.warn(
        "[loadRecentRentEntries] rents_in_bbox RPC unavailable, using lat/lng filter",
        rpc.error.message,
      );
    }

    const { data, error } = await supabase
      .from(RENT_ENTRIES_EXPANDED)
      .select("*")
      .gte("created_at", sinceIso)
      .gte("lat", bbox.minLat)
      .lte("lat", bbox.maxLat)
      .gte("lng", bbox.minLng)
      .lte("lng", bbox.maxLng);

    if (!error && data?.length) {
      const seen = new Set(rows.map((x) => x.id));
      for (const r of data) {
        const m = normalizeRentRow(r as Record<string, unknown>);
        if (!seen.has(m.id)) {
          seen.add(m.id);
          rows.push(m);
        }
      }
    }
  } else {
    const { data, error } = await supabase
      .from(RENT_ENTRIES_EXPANDED)
      .select("*")
      .gte("created_at", sinceIso);
    if (!error && data?.length) {
      const seen = new Set(rows.map((x) => x.id));
      for (const r of data) {
        const m = normalizeRentRow(r as Record<string, unknown>);
        if (!seen.has(m.id)) {
          seen.add(m.id);
          rows.push(m);
        }
      }
    }
  }

  return sortEntriesByRecentFirst(rows);
}
