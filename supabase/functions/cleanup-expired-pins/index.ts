import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { log } from "../lib/logger.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../lib/cors.ts";

/**
 * Intended for Supabase Scheduled Functions or external cron (POST with cron secret).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed");
  }

  const fn = "cleanup-expired-pins";
  const secret = Deno.env.get("CRON_SECRET");
  const hdr = req.headers.get("x-cron-secret");
  if (secret && hdr !== secret) {
    log.warn(fn, "unauthorized_cleanup_attempt");
    return errorResponse(401, "unauthorized");
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    log.error(fn, "missing_supabase_env");
    return errorResponse(500, "server_misconfigured");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("cleanup_expired_pins");

  if (error) {
    log.error(fn, "rpc_failed", { message: error.message });
    return errorResponse(500, "cleanup_failed", { detail: error.message });
  }

  const deleted = typeof data === "number" ? data : Number(data);
  log.info(fn, "cleanup_complete", { deleted });
  return jsonResponse({ deleted });
});
