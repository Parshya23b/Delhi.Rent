import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { log } from "../lib/logger.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../lib/cors.ts";
import type { BBox, MapPin, PinRow } from "../lib/types.ts";

function validateBbox(b: BBox): string | null {
  const { west, south, east, north } = b;
  if ([west, south, east, north].some((v) => typeof v !== "number" || !Number.isFinite(v))) return "invalid_bbox";
  if (west < -180 || east > 180 || south < -90 || north > 90) return "bbox_out_of_range";
  if (west >= east || south >= north) return "bbox_inverted";
  const spanX = east - west;
  const spanY = north - south;
  if (spanX > 5 || spanY > 5) return "bbox_too_large";
  return null;
}

function toPublicPin(p: PinRow): MapPin {
  const { email: _e, phone: _p, ...rest } = p;
  return rest;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse(405, "method_not_allowed");
  }

  const fn = "get-pins";
  const urlObj = new URL(req.url);
  let bbox: BBox;

  if (req.method === "GET") {
    bbox = {
      west: Number(urlObj.searchParams.get("west")),
      south: Number(urlObj.searchParams.get("south")),
      east: Number(urlObj.searchParams.get("east")),
      north: Number(urlObj.searchParams.get("north")),
    };
  } else {
    try {
      bbox = (await req.json()) as BBox;
    } catch {
      return errorResponse(400, "invalid_json");
    }
  }

  const err = validateBbox(bbox);
  if (err) return errorResponse(400, err);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    log.error(fn, "missing_supabase_env");
    return errorResponse(500, "server_misconfigured");
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("get_pins_in_bbox", {
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
  });

  if (error) {
    log.error(fn, "rpc_failed", { message: error.message });
    return errorResponse(500, "query_failed", { detail: error.message });
  }

  const pins = ((data ?? []) as PinRow[]).map(toPublicPin);
  return jsonResponse({ pins });
});
