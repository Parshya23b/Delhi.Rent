import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { checkRateLimit } from "../lib/rateLimit.ts";
import { notifyMatchPair } from "../lib/email.ts";
import { log } from "../lib/logger.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../lib/cors.ts";
import type { CreatePinPayload, PinRow } from "../lib/types.ts";

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
}

function validatePayload(body: CreatePinPayload): string | null {
  if (typeof body.lat !== "number" || body.lat < -90 || body.lat > 90) return "invalid_lat";
  if (typeof body.lng !== "number" || body.lng < -180 || body.lng > 180) return "invalid_lng";
  if (body.type !== "seeker" && body.type !== "listing") return "invalid_type";
  if (typeof body.rent !== "number" || !Number.isFinite(body.rent) || body.rent < 0) return "invalid_rent";
  if (typeof body.bhk !== "number" || !Number.isInteger(body.bhk) || body.bhk < 0 || body.bhk > 20) return "invalid_bhk";
  if (body.deposit != null && (typeof body.deposit !== "number" || body.deposit < 0)) return "invalid_deposit";
  return null;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed");
  }

  const fn = "create-pin";
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 25, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    log.warn(fn, "rate_limited", { ip, retryAfterMs: rl.retryAfterMs });
    return errorResponse(429, "rate_limited", { retry_after_ms: rl.retryAfterMs });
  }

  let body: CreatePinPayload;
  try {
    body = (await req.json()) as CreatePinPayload;
  } catch {
    return errorResponse(400, "invalid_json");
  }

  const err = validatePayload(body);
  if (err) return errorResponse(400, err);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    log.error(fn, "missing_supabase_env");
    return errorResponse(500, "server_misconfigured");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: created, error: insErr } = await admin.rpc("insert_pin_at", {
    p_lat: body.lat,
    p_lng: body.lng,
    p_type: body.type,
    p_rent: body.rent,
    p_bhk: body.bhk,
    p_deposit: body.deposit ?? null,
    p_available_from: body.available_from ?? null,
    p_preferences: body.preferences ?? {},
    p_email: body.email ?? null,
    p_phone: body.phone ?? null,
    p_description: body.description ?? null,
  });

  if (insErr || !created) {
    log.error(fn, "insert_failed", { message: insErr?.message });
    return errorResponse(400, "insert_failed", { detail: insErr?.message });
  }

  const pin = (Array.isArray(created) ? created[0] : created) as PinRow;

  const minRent = typeof body.min_rent === "number" ? body.min_rent : 0;
  const maxRent = typeof body.max_rent === "number" ? body.max_rent : 999_999_999;
  const userBhk = body.match_all_bhk === true ? null : body.bhk;

  const { data: matches, error: rpcErr } = await admin.rpc("find_matches", {
    user_lat: body.lat,
    user_lng: body.lng,
    user_type: body.type,
    min_rent: minRent,
    max_rent: maxRent,
    user_bhk: userBhk,
    exclude_pin_id: pin.id,
  });

  if (rpcErr) {
    log.error(fn, "find_matches_failed", { message: rpcErr.message });
    return jsonResponse({ pin, matches: [], match_error: rpcErr.message }, { status: 201 });
  }

  const matchRows = (matches ?? []) as PinRow[];
  const persisted: { id: string; pin_a: string; pin_b: string; email_sent: boolean }[] = [];

  for (const other of matchRows) {
    const [a, b] = orderedPair(pin.id, other.id);
    const { data: mrow, error: mErr } = await admin
      .from("matches")
      .insert({ pin_a: a, pin_b: b, email_sent: false })
      .select("id,pin_a,pin_b,email_sent")
      .single();

    if (mErr) {
      const dup = mErr.code === "23505" || mErr.message?.toLowerCase().includes("duplicate");
      if (dup) {
        log.debug(fn, "match_duplicate_skipped", { a, b });
        continue;
      }
      log.warn(fn, "match_insert_failed", { message: mErr.message });
      continue;
    }
    if (!mrow) continue;

    const emailed = await notifyMatchPair(pin, other);
    const anyMail = emailed.aOk || emailed.bOk;
    if (anyMail) {
      await admin.from("matches").update({ email_sent: true }).eq("id", mrow.id);
    }
    persisted.push({ ...mrow, email_sent: anyMail });
    log.info(fn, "match_recorded", { match_id: mrow.id, email_sent: anyMail });
  }

  return jsonResponse({ pin, matches: matchRows, match_records: persisted }, { status: 201 });
});
