import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import { getSupabaseRead } from "@/lib/supabase/service";
import type { RentEntry } from "@/types/rent";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Flat map pin from the database (no mock data).
 *
 * After migration 009, `rent_entries` has no `lat`/`lng` columns — coordinates
 * live on `areas`. The `rent_entries_expanded` view joins them so each row is
 * one pin with map coordinates and monthly rent.
 */
export type RentPin = {
  id: string;
  lat: number;
  lng: number;
  rent: number;
  bhk: string;
  created_at: string;
  women_only: boolean;
  furnishing: string | null;
};

/** Map a DB pin to the app’s `RentEntry` shape (for clustering / markers). */
export function rentPinToRentEntry(p: RentPin): RentEntry {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    rent_inr: p.rent,
    bhk: p.bhk,
    area_label: null,
    move_in_month: null,
    broker_or_owner: null,
    furnishing: p.furnishing,
    maintenance_inr: null,
    deposit_inr: null,
    opt_in_building_aggregate: false,
    women_only: Boolean(p.women_only),
    created_at: p.created_at,
    verification_status: "unverified",
    confirmations_count: 0,
    last_updated: p.created_at,
  };
}

/** One row from `rent_entries_expanded` (or compatible `select`). */
export function rentPinFromExpandedRow(row: Record<string, unknown>): RentPin | null {
  return rowToRentPin(row);
}

function rowToRentPin(row: Record<string, unknown>): RentPin | null {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const rentRaw = row.rent_inr ?? row.rent;
  const rent = Number(rentRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(rent)) {
    return null;
  }
  return {
    id: String(row.id),
    lat,
    lng,
    rent,
    bhk: String(row.bhk ?? ""),
    created_at:
      row.created_at != null && row.created_at !== ""
        ? String(row.created_at)
        : new Date().toISOString(),
    women_only: Boolean(row.women_only),
    furnishing:
      row.furnishing != null && String(row.furnishing).trim() !== ""
        ? String(row.furnishing)
        : null,
  };
}

/**
 * Load all recent rent pins from Supabase (newest first).
 * Uses the expanded view so `lat` / `lng` are real columns on the read model.
 */
export async function getRentPins(
  client?: SupabaseClient | null,
): Promise<RentPin[]> {
  const supabase = client ?? getSupabaseRead();
  if (!supabase) {
    console.warn(
      "[getRentPins] No Supabase client — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for server-only reads).",
    );
    return [];
  }

  const { data, error } = await supabase
    .from(RENT_ENTRIES_EXPANDED)
    .select("id, lat, lng, rent_inr, bhk, created_at, women_only, furnishing")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getRentPins] query failed", error.message, error);
    return [];
  }

  const pins: RentPin[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const pin = rentPinFromExpandedRow(row);
    if (pin) pins.push(pin);
  }

  console.log("[getRentPins] loaded", pins.length, "pins from DB");
  return pins;
}
