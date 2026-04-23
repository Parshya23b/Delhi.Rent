import { NextResponse } from "next/server";
import { hashDeviceId } from "@/lib/device-hash";
import {
  confirmPinMemory,
  hasMemoryConfirmed,
  ipAllowed,
} from "@/lib/confirmations-memory";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import { getSupabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function ipFromReq(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "anon";
}

type ConfirmResponse = {
  ok: boolean;
  alreadyConfirmed?: boolean;
  demo?: boolean;
  confirmations_count: number;
  verification_status: string;
  last_updated: string;
  entry_id: string;
};

export async function POST(req: Request) {
  const deviceIdRaw = req.headers.get("x-device-id") ?? "anon";
  const deviceHash = hashDeviceId(deviceIdRaw);
  const ipHash = hashDeviceId(ipFromReq(req));

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entryId = body.id;
  if (!entryId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (!ipAllowed(ipHash)) {
    return NextResponse.json(
      {
        error: "Too many confirmations from this network. Try again later.",
        code: "IP_RATE_LIMIT",
      },
      { status: 429 },
    );
  }

  const isDemo = entryId.startsWith("dummy-") || entryId.startsWith("local-");
  const supabase = getSupabaseService();

  if (isDemo || !supabase) {
    if (hasMemoryConfirmed(entryId, deviceHash)) {
      const mem = confirmPinMemory(entryId, deviceHash);
      const res: ConfirmResponse = {
        ok: true,
        alreadyConfirmed: true,
        demo: isDemo,
        confirmations_count: mem.confirmations_count,
        verification_status: "self-reported",
        last_updated: mem.last_updated,
        entry_id: entryId,
      };
      return NextResponse.json(res);
    }
    const mem = confirmPinMemory(entryId, deviceHash);
    const res: ConfirmResponse = {
      ok: true,
      alreadyConfirmed: false,
      demo: isDemo,
      confirmations_count: mem.confirmations_count,
      verification_status: "self-reported",
      last_updated: mem.last_updated,
      entry_id: entryId,
    };
    return NextResponse.json(res);
  }

  const { data: entry, error: fetchErr } = await supabase
    .from(RENT_ENTRIES_EXPANDED)
    .select("id, device_id_hash")
    .eq("id", entryId)
    .maybeSingle();

  if (fetchErr || !entry) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  if (String(entry.device_id_hash ?? "") === deviceHash) {
    return NextResponse.json(
      { error: "You cannot confirm your own pin.", code: "SELF_CONFIRM" },
      { status: 400 },
    );
  }

  const { error: insErr } = await supabase.from("verification_logs").insert({
    rent_entry_id: entryId,
    action: "confirmed",
    user_id: deviceHash,
  });

  if (insErr) {
    const code = insErr.code ?? "";
    const msg = insErr.message?.toLowerCase() ?? "";
    if (code === "23505" || msg.includes("unique") || msg.includes("duplicate")) {
      const fresh = await supabase
        .from(RENT_ENTRIES_EXPANDED)
        .select("*")
        .eq("id", entryId)
        .maybeSingle();
      const data = fresh.data as Record<string, unknown> | null;
      const normalized = data ? normalizeRentRow(data) : null;
      const res: ConfirmResponse = {
        ok: true,
        alreadyConfirmed: true,
        confirmations_count: normalized?.confirmations_count ?? 0,
        verification_status: normalized?.verification_status ?? "self-reported",
        last_updated: normalized?.last_updated ?? new Date().toISOString(),
        entry_id: entryId,
      };
      return NextResponse.json(res);
    }

    if (msg.includes("verification_logs") || code === "42P01") {
      console.warn(
        "[confirm] verification_logs missing — run migration 009. Falling back to memory.",
      );
      const mem = confirmPinMemory(entryId, deviceHash);
      const res: ConfirmResponse = {
        ok: true,
        alreadyConfirmed: mem.alreadyConfirmed,
        confirmations_count: mem.confirmations_count,
        verification_status: "self-reported",
        last_updated: mem.last_updated,
        entry_id: entryId,
      };
      return NextResponse.json(res);
    }

    console.error("[confirm]", insErr);
    return NextResponse.json(
      { error: "Could not save confirmation" },
      { status: 500 },
    );
  }

  const fresh = await supabase
    .from(RENT_ENTRIES_EXPANDED)
    .select("*")
    .eq("id", entryId)
    .maybeSingle();

  if (fresh.error || !fresh.data) {
    const res: ConfirmResponse = {
      ok: true,
      alreadyConfirmed: false,
      confirmations_count: 1,
      verification_status: "self-reported",
      last_updated: new Date().toISOString(),
      entry_id: entryId,
    };
    return NextResponse.json(res);
  }

  const normalized = normalizeRentRow(fresh.data as Record<string, unknown>);
  const res: ConfirmResponse = {
    ok: true,
    alreadyConfirmed: false,
    confirmations_count: normalized.confirmations_count ?? 0,
    verification_status: normalized.verification_status ?? "self-reported",
    last_updated: normalized.last_updated ?? new Date().toISOString(),
    entry_id: entryId,
  };
  return NextResponse.json(res);
}
