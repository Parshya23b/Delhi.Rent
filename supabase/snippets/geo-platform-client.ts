/**
 * Example Supabase client usage for migration `026_geo_rental_platform_reset.sql`.
 * Use anon key in browser for inserts/selects where RLS allows; use service role only on server.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function geoClient(): SupabaseClient {
  return createClient(url, anon);
}

/** Direct insert (trigger fills `location` from lat/lng). */
export async function insertOwnerPinExample(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("pins")
    .insert({
      type: "owner",
      lat: 12.97,
      lng: 77.59,
      rent: 25000,
      bhk: 2,
      furnishing: "semi",
      preferences: { pets: false },
      contact_email: "owner@example.com",
      ip_hash: "hash-demo-owner",
    })
    .select()
    .single();
  return { data, error };
}

/** Prefer RPC so lat/lng + rate limit stay consistent server-side. */
export async function insertPinRpcExample(sb: SupabaseClient) {
  const { data, error } = await sb.rpc("insert_pin", {
    p_type: "seeker",
    p_lat: 12.971,
    p_lng: 77.591,
    p_rent: 24000,
    p_bhk: 2,
    p_furnishing: null,
    p_preferences: {},
    p_contact_email: "seeker@example.com",
    p_contact_phone: null,
    p_ip_hash: "hash-demo-seeker",
  });
  return { data, error };
}

export async function nearbyExample(sb: SupabaseClient) {
  return sb.rpc("get_nearby_pins", {
    user_lat: 12.97,
    user_lng: 77.59,
    radius: 2000,
  });
}

export async function boundsExample(sb: SupabaseClient) {
  return sb.rpc("get_pins_in_bounds", {
    lat_min: 12.9,
    lat_max: 13.1,
    lng_min: 77.4,
    lng_max: 77.7,
  });
}

/** Must run with service role (e.g. Edge Function or server script). */
export async function runMatchEngine(service: SupabaseClient) {
  return service.rpc("match_pins");
}

export async function softDeleteExpired(service: SupabaseClient) {
  return service.rpc("delete_expired_pins");
}
