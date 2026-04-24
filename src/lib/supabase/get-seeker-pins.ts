import { getSupabaseRead } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Active seeker demand pin for the map (from `public.seeker_pins`). */
export type SeekerMapPin = {
  id: string;
  lat: number;
  lng: number;
  budget: number;
  radius_km: number;
  /** Matches `bhk_preference` in DB (0–10 or null). */
  bhk: number | null;
  created_at: string;
};

/** Map one `seeker_pins` row (API / Realtime payload). Inactive rows → `null`. */
export function seekerMapPinFromRow(r: Record<string, unknown>): SeekerMapPin | null {
  if (r.is_active === false) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  const budget = Number(r.budget);
  const radiusRaw = Number(r.radius_km);
  const radius_km =
    Number.isFinite(radiusRaw) && radiusRaw > 0 && radiusRaw <= 100
      ? Math.round(radiusRaw)
      : 2;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(budget)) return null;
  const id = r.id != null && r.id !== "" ? String(r.id) : "";
  if (!id) return null;

  const bhkRaw = r.bhk_preference;
  const bhk =
    bhkRaw == null || bhkRaw === ""
      ? null
      : Number.isFinite(Number(bhkRaw))
        ? Math.round(Number(bhkRaw))
        : null;

  return {
    id,
    lat,
    lng,
    budget,
    radius_km,
    bhk,
    created_at:
      r.created_at != null && r.created_at !== ""
        ? String(r.created_at)
        : new Date().toISOString(),
  };
}

export async function getSeekerPins(
  client?: SupabaseClient | null,
): Promise<SeekerMapPin[]> {
  const supabase = client ?? getSupabaseRead();
  if (!supabase) {
    console.warn("[getSeekerPins] No Supabase client.");
    return [];
  }

  const { data, error } = await supabase
    .from("seeker_pins")
    .select("id, lat, lng, budget, radius_km, bhk_preference, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getSeekerPins] query failed", error.message, error);
    return [];
  }

  console.log("[getSeekerPins] fetched rows from DB", (data ?? []).length);

  const out: SeekerMapPin[] = [];
  for (const row of data ?? []) {
    const pin = seekerMapPinFromRow(row as Record<string, unknown>);
    if (pin) out.push(pin);
  }

  console.log("[getSeekerPins] active map pins", out.length);
  return out;
}
