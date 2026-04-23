import type { SupabaseClient } from "@supabase/supabase-js";

export class ContactServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ContactServiceError";
  }
}

function assert(cond: unknown, code: string, message: string, status = 400): asserts cond {
  if (!cond) throw new ContactServiceError(code, message, status);
}

export async function requestContact(
  supabase: SupabaseClient,
  seekerPinId: string,
  /** From auth middleware — must match JWT user for RPC. */
  responderUserId: string,
) {
  assert(
    typeof seekerPinId === "string" && seekerPinId.length > 0,
    "VALIDATION",
    "seeker_id (pin uuid) is required.",
  );
  assert(
    typeof responderUserId === "string" && responderUserId.length > 0,
    "UNAUTHORIZED",
    "Missing authenticated user.",
    401,
  );

  const { data, error } = await supabase.rpc("request_contact", {
    seeker_id: seekerPinId,
    responder_id: responderUserId,
  });

  if (error) {
    const msg = error.message ?? "request_contact failed";
    const lower = msg.toLowerCase();
    const status =
      lower.includes("authentication required") || lower.includes("must match")
        ? 401
        : lower.includes("verified email")
          ? 403
          : lower.includes("not allowed") || lower.includes("own pin")
            ? 403
            : lower.includes("not found")
              ? 404
              : 400;
    throw new ContactServiceError("REQUEST_FAILED", msg, status, error);
  }

  return { status: data as string };
}

export async function respondToContactRequest(
  supabase: SupabaseClient,
  requestId: string,
  action: "approve" | "reject",
) {
  assert(typeof requestId === "string" && requestId.length > 0, "VALIDATION", "request_id is required.");
  assert(action === "approve" || action === "reject", "VALIDATION", "action must be approve or reject.");

  const { data, error } = await supabase.rpc("respond_contact", {
    request_id: requestId,
    decision: action,
  });

  if (error) {
    const msg = error.message ?? "respond_contact failed";
    const lower = msg.toLowerCase();
    const status =
      lower.includes("authentication required")
        ? 401
        : lower.includes("verified email")
          ? 403
          : lower.includes("not found") || lower.includes("not allowed")
            ? 404
            : 400;
    throw new ContactServiceError("RESPOND_FAILED", msg, status, error);
  }

  return data as Record<string, unknown>;
}
