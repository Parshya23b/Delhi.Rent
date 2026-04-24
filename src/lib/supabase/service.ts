import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _anonReadClient: SupabaseClient | null = null;

/** Decode `role` from a Supabase JWT (legacy `eyJ...` keys only). */
function jwtRoleFromKey(key: string): string | null {
  if (!key.startsWith("eyJ")) return null;
  try {
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const pad = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(pad, "base64").toString("utf8");
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side Supabase client. Must use the **service_role** secret from
 * Supabase → Project Settings → API (not the anon/public key). The service
 * role bypasses RLS so `/api/rents` can insert rows. If you put the anon key
 * here by mistake, inserts fail with permission errors.
 *
 * New opaque keys (`sb_secret_...`) are passed through; JWT role checks only
 * apply to legacy JWT secrets.
 */
export function getSupabaseService(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const role = jwtRoleFromKey(key);
  if (role === "anon") {
    console.error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY looks like the anon JWT. Use the service_role secret from Supabase → Settings → API so inserts are allowed.",
    );
    return null;
  }

  if (!_client) _client = createClient(url, key);
  return _client;
}

/**
 * Client for **reading** `rent_entries` (map, leaderboard, regional median) and
 * for **server-side API writes** (e.g. `POST /api/rents`) when you prefer the
 * same client as the browser: {@link getSupabaseService} is used first when
 * set; otherwise the anon key is used. Crowdsource migrations allow `anon`
 * `insert` on `areas` / `rent_entries` / `rent_sources`, so pins persist even
 * if `SUPABASE_SERVICE_ROLE_KEY` is not configured (service role is still
 * recommended for admin paths and for rollbacks that need `delete` under
 * stricter RLS).
 */
export function getSupabaseRead(): SupabaseClient | null {
  const svc = getSupabaseService();
  if (svc) return svc;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;

  if (!_anonReadClient) _anonReadClient = createClient(url, anon);
  return _anonReadClient;
}
