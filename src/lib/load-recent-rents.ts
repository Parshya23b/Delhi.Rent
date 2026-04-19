import { generateDummyRents } from "@/lib/dummy-rents";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { isPinExpired, PIN_MAX_AGE_MS } from "@/lib/rent-policy";
import { getSupabaseService } from "@/lib/supabase/service";
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

function inBbox(
  lat: number,
  lng: number,
  bbox: RentBbox | null | undefined,
): boolean {
  if (!bbox) return true;
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/** Dummy + Supabase rows within retention window; optional viewport bbox (PostGIS RPC or lat/lng filter). */
export async function loadRecentRentEntries(opts?: {
  bbox?: RentBbox | null;
}): Promise<RentEntry[]> {
  const bbox = opts?.bbox ?? null;
  const dummy = generateDummyRents()
    .filter((r) => !isPinExpired(r.created_at))
    .filter((r) => inBbox(r.lat, r.lng, bbox));
  const rows: RentEntry[] = [...dummy];

  const supabase = getSupabaseService();
  if (supabase) {
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
        .from("rent_entries")
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
        .from("rent_entries")
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
  }

  return sortEntriesByRecentFirst(rows);
}
