import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { checkRateLimit } from "../lib/rateLimit.ts";
import { log } from "../lib/logger.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../lib/cors.ts";

type ReportBody = {
  pin_id: string;
  reason?: string | null;
  threshold?: number;
};

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed");
  }

  const fn = "report-pin";
  const ip = getClientIp(req);
  const rl = checkRateLimit(`report:${ip}`, { max: 40, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return errorResponse(429, "rate_limited", { retry_after_ms: rl.retryAfterMs });
  }

  let body: ReportBody;
  try {
    body = (await req.json()) as ReportBody;
  } catch {
    return errorResponse(400, "invalid_json");
  }

  if (typeof body.pin_id !== "string" || body.pin_id.length < 10) {
    return errorResponse(400, "invalid_pin_id");
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    log.error(fn, "missing_supabase_env");
    return errorResponse(500, "server_misconfigured");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("report_pin", {
    p_pin_id: body.pin_id,
    p_reason: body.reason ?? null,
    p_flag_threshold: typeof body.threshold === "number" ? body.threshold : 5,
  });

  if (error) {
    log.error(fn, "rpc_failed", { message: error.message });
    return errorResponse(500, "report_failed", { detail: error.message });
  }

  log.info(fn, "report_ok", { pin_id: body.pin_id });
  return jsonResponse({ result: data });
});
