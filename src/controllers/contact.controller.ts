import type { NextRequest } from "next/server";
import { HEADER_USER_ID } from "@/lib/auth/constants";
import { jsonErr, jsonOk, readJsonBody } from "@/lib/http/api-response";
import { getSupabaseUserFromRequest } from "@/lib/supabase/user-server-client";
import {
  ContactServiceError,
  requestContact,
  respondToContactRequest,
} from "@/services/contact.service";

export async function handleContactRequest(req: NextRequest) {
  const ctx = getSupabaseUserFromRequest(req);
  const userId = req.headers.get(HEADER_USER_ID);
  if (!ctx || !userId) {
    return jsonErr("UNAUTHORIZED", "Missing Authorization: Bearer <access_token>.", 401);
  }

  const raw = await readJsonBody(req);
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const seekerId = typeof body?.seeker_id === "string" ? body.seeker_id : null;
  if (!seekerId) {
    return jsonErr("VALIDATION", "Body must include seeker_id (seeker pin uuid).", 400);
  }

  try {
    const out = await requestContact(ctx.client, seekerId, userId);
    return jsonOk(out, 201);
  } catch (e) {
    if (e instanceof ContactServiceError) {
      return jsonErr(e.code, e.message, e.status, e.details);
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return jsonErr("INTERNAL", message, 500);
  }
}

export async function handleContactRespond(req: NextRequest) {
  const ctx = getSupabaseUserFromRequest(req);
  if (!ctx) {
    return jsonErr("UNAUTHORIZED", "Missing Authorization: Bearer <access_token>.", 401);
  }

  const raw = await readJsonBody(req);
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const requestId = typeof body?.request_id === "string" ? body.request_id : null;
  const action = body?.action === "approve" || body?.action === "reject" ? body.action : null;

  if (!requestId) {
    return jsonErr("VALIDATION", "Body must include request_id (contact_requests.id).", 400);
  }
  if (!action) {
    return jsonErr("VALIDATION", "Body must include action: approve | reject.", 400);
  }

  try {
    const row = await respondToContactRequest(ctx.client, requestId, action);
    return jsonOk({ contact_request: row });
  } catch (e) {
    if (e instanceof ContactServiceError) {
      return jsonErr(e.code, e.message, e.status, e.details);
    }
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return jsonErr("INTERNAL", message, 500);
  }
}
