import type { NextRequest } from "next/server";
import { HEADER_USER_ID } from "@/lib/auth/constants";
import { jsonErr, jsonOk, readJsonBody } from "@/lib/http/api-response";
import { getSupabaseUserFromRequest } from "@/lib/supabase/user-server-client";
import { createSeekerPin, SeekerServiceError, type CreateSeekerPinPayload } from "@/services/seeker.service";

export const dynamic = "force-dynamic";

function parsePayload(raw: Record<string, unknown>): CreateSeekerPinPayload | null {
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const budget = Math.round(Number(raw.budget));
  const bhk = Math.round(Number(raw.bhk));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Number.isFinite(budget) || !Number.isFinite(bhk)) return null;
  return { lat, lng, budget, bhk };
}

export async function POST(req: NextRequest) {
  const ctx = getSupabaseUserFromRequest(req);
  const userId = req.headers.get(HEADER_USER_ID);
  if (!ctx || !userId) {
    return jsonErr("UNAUTHORIZED", "Missing Authorization: Bearer <access_token>.", 401);
  }

  const raw = await readJsonBody(req);
  if (raw === null || typeof raw !== "object") {
    return jsonErr("INVALID_JSON", "Request body must be JSON.", 400);
  }

  const payload = parsePayload(raw as Record<string, unknown>);
  if (!payload) {
    return jsonErr("VALIDATION", "Body must include numeric lat, lng, budget, and bhk.", 400);
  }

  try {
    const result = await createSeekerPin(ctx.client, payload, userId);
    console.log("[POST /api/seeker/pin] created", { id: (result.pin as { id?: string }).id });
    return jsonOk(result, 201);
  } catch (e) {
    if (e instanceof SeekerServiceError) {
      return jsonErr(e.code, e.message, e.status, e.details);
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return jsonErr("INTERNAL", message, 500);
  }
}
