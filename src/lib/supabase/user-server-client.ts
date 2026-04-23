import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseUserContext = {
  client: SupabaseClient;
  /** Same JWT sent as Authorization: Bearer (needed for auth.getUser(jwt)). */
  accessToken: string;
};

/**
 * Supabase client scoped to the caller’s JWT (PostgREST + RLS as that user).
 * Pass `Authorization: Bearer <access_token>` from the browser or native app.
 */
export function getSupabaseUserFromRequest(req: Request): SupabaseUserContext | null {
  const auth = req.headers.get("authorization");
  const token =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon || !token) return null;

  const client = createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return { client, accessToken: token };
}
