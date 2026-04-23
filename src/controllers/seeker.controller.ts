import type { NextRequest } from "next/server";
import { HEADER_USER_ID } from "@/lib/auth/constants";
import { jsonErr, jsonOk, readJsonBody } from "@/lib/http/api-response";
import { getSupabaseUserFromRequest } from "@/lib/supabase/user-server-client";
import {
  createSeekerPinWithPreferences,
  listMatchesForSeeker,
  runMatchSeeker,
  SeekerServiceError,
} from "@/services/seeker.service";
import type { CreateSeekerPinBody } from "@/types/seeker-auth";

export async function handleSeekerCreate(req: NextRequest) {
  const ctx = getSupabaseUserFromRequest(req);
  const userId = req.headers.get(HEADER_USER_ID);
  if (!ctx || !userId) {
    return jsonErr("UNAUTHORIZED", "Missing Authorization: Bearer <access_token>.", 401);
  }

  const raw = await readJsonBody(req);
  if (raw === null || typeof raw !== "object") {
    return jsonErr("INVALID_JSON", "Request body must be JSON.", 400);
  }

  try {
    const result = await createSeekerPinWithPreferences(ctx.client, raw as CreateSeekerPinBody, userId);
    return jsonOk(result, 201);
  } catch (e) {
    if (e instanceof SeekerServiceError) {
      return jsonErr(e.code, e.message, e.status, e.details);
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return jsonErr("INTERNAL", message, 500);
  }
}

export async function handleSeekerMatch(req: NextRequest) {
  const ctx = getSupabaseUserFromRequest(req);
  if (!ctx) {
    return jsonErr("UNAUTHORIZED", "Missing Authorization: Bearer <access_token>.", 401);
  }

  const raw = await readJsonBody(req);
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const seekerId = typeof body?.seeker_id === "string" ? body.seeker_id : null;
  if (!seekerId) {
    return jsonErr("VALIDATION", "Body must include seeker_id (seeker pin uuid).", 400);
  }

  try {
    const matches = await runMatchSeeker(ctx.client, seekerId);
    return jsonOk({ matches });
  } catch (e) {
    if (e instanceof SeekerServiceError) {
      return jsonErr(e.code, e.message, e.status, e.details);
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return jsonErr("INTERNAL", message, 500);
  }
}

export async function handleSeekerMatchesGet(req: NextRequest) {
  const ctx = getSupabaseUserFromRequest(req);
  if (!ctx) {
    return jsonErr("UNAUTHORIZED", "Missing Authorization: Bearer <access_token>.", 401);
  }

  const seekerId = req.nextUrl.searchParams.get("seeker_id");
  if (!seekerId) {
    return jsonErr("VALIDATION", "Query parameter seeker_id (pin uuid) is required.", 400);
  }

  try {
    const rows = await listMatchesForSeeker(ctx.client, seekerId);
    return jsonOk({ matches: rows });
  } catch (e) {
    if (e instanceof SeekerServiceError) {
      return jsonErr(e.code, e.message, e.status, e.details);
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return jsonErr("INTERNAL", message, 500);
  }
}
