import { NextResponse } from "next/server";
import {
  hasRecentDuplicateInSupabase,
  hasRecentDuplicateMemory,
  recordSubmittedPinMemory,
} from "@/lib/duplicate-submission";
import { hashDeviceId } from "@/lib/device-hash";
import { loadRecentRentEntries } from "@/lib/load-recent-rents";
import {
  isBannedMemory,
  registerLocalEntryAuthor,
} from "@/lib/moderation-memory";
import {
  collectNearbyRentAmountsForMedian,
  validateRentAgainstRegionalMedian,
} from "@/lib/nearby-rents-for-median";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { SUBMISSION_COOLDOWN_MS } from "@/lib/rent-policy";
import { getSupabaseService } from "@/lib/supabase/service";
import {
  checkCooldownMemory,
  recordSubmission,
} from "@/lib/submission-cooldown";
import { BHK_OPTIONS } from "@/types/rent";

export const dynamic = "force-dynamic";

function parseBbox(searchParams: URLSearchParams) {
  const minLat = Number(searchParams.get("minLat"));
  const maxLat = Number(searchParams.get("maxLat"));
  const minLng = Number(searchParams.get("minLng"));
  const maxLng = Number(searchParams.get("maxLng"));
  if (
    [minLat, maxLat, minLng, maxLng].some((n) => Number.isNaN(n)) ||
    minLat >= maxLat ||
    minLng >= maxLng
  ) {
    return null;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bbox = parseBbox(searchParams);

  const rows = await loadRecentRentEntries({ bbox: bbox ?? undefined });

  return NextResponse.json({ entries: rows });
}

async function isDeviceBanned(
  supabase: NonNullable<ReturnType<typeof getSupabaseService>>,
  deviceHash: string,
): Promise<boolean> {
  if (isBannedMemory(deviceHash)) return true;
  const { data } = await supabase
    .from("banned_posting_devices")
    .select("device_id_hash")
    .eq("device_id_hash", deviceHash)
    .maybeSingle();
  return Boolean(data);
}

async function assertCooldownOk(
  supabase: NonNullable<ReturnType<typeof getSupabaseService>>,
  deviceHash: string,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const mem = checkCooldownMemory(deviceHash);
  if (!mem.ok) {
    return { ok: false, retryAfterSec: mem.retryAfterSec ?? 3600 };
  }

  const { data } = await supabase
    .from("rent_entries")
    .select("created_at")
    .eq("device_id_hash", deviceHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return { ok: true };
  const last = new Date(String(data.created_at)).getTime();
  const elapsed = Date.now() - last;
  if (elapsed >= SUBMISSION_COOLDOWN_MS) return { ok: true };
  const retryAfterSec = Math.ceil((SUBMISSION_COOLDOWN_MS - elapsed) / 1000);
  return { ok: false, retryAfterSec };
}

export async function POST(req: Request) {
  const deviceIdRaw = req.headers.get("x-device-id") ?? "anon";
  const deviceHash = hashDeviceId(deviceIdRaw);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const rent_inr = Math.round(Number(body.rent_inr));
  const bhk = String(body.bhk ?? "");
  const area_label = body.area_label != null ? String(body.area_label) : null;
  const move_in_month =
    body.move_in_month != null ? String(body.move_in_month) : null;
  const broker_or_owner =
    body.broker_or_owner != null ? String(body.broker_or_owner) : null;
  const furnishing = body.furnishing != null ? String(body.furnishing) : null;
  const maintenance_inr =
    body.maintenance_inr != null && body.maintenance_inr !== ""
      ? Math.round(Number(body.maintenance_inr))
      : null;
  const deposit_inr =
    body.deposit_inr != null && body.deposit_inr !== ""
      ? Math.round(Number(body.deposit_inr))
      : null;
  const opt_in_building_aggregate = Boolean(body.opt_in_building_aggregate);
  const women_only = Boolean(body.women_only);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "Invalid map location. Tap the map again to place the pin.", field: "general", code: "INVALID_LOCATION" },
      { status: 400 },
    );
  }

  if (Number.isNaN(rent_inr)) {
    return NextResponse.json(
      { error: "Enter a valid monthly rent amount.", field: "rent", code: "INVALID_RENT" },
      { status: 400 },
    );
  }

  if (!BHK_OPTIONS.includes(bhk as (typeof BHK_OPTIONS)[number])) {
    return NextResponse.json(
      { error: "Choose a BHK type.", field: "bhk", code: "INVALID_BHK" },
      { status: 400 },
    );
  }

  if (rent_inr < 2000 || rent_inr > 2000000) {
    return NextResponse.json(
      {
        error: "Rent must be between ₹2,000 and ₹20,00,000 per month.",
        field: "rent",
        code: "RENT_RANGE",
      },
      { status: 400 },
    );
  }

  if (move_in_month != null && move_in_month !== "") {
    if (!/^\d{4}-\d{2}$/.test(move_in_month)) {
      return NextResponse.json(
        {
          error: "Use the month picker (year–month).",
          field: "move_in_month",
          code: "INVALID_MOVE_IN",
        },
        { status: 400 },
      );
    }
  }

  if (
    maintenance_inr != null &&
    (maintenance_inr < 0 || maintenance_inr > 500000)
  ) {
    return NextResponse.json(
      { error: "Maintenance must be between ₹0 and ₹5,00,000.", field: "maintenance", code: "INVALID_MAINTENANCE" },
      { status: 400 },
    );
  }
  if (deposit_inr != null && (deposit_inr < 0 || deposit_inr > 50000000)) {
    return NextResponse.json(
      { error: "Security deposit looks invalid. Check the amount.", field: "deposit", code: "INVALID_DEPOSIT" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseService();

  if (supabase) {
    if (await isDeviceBanned(supabase, deviceHash)) {
      return NextResponse.json(
        {
          error:
            "Posting is disabled for this device after repeated reports on your submissions. Contact support if this is a mistake.",
          code: "BANNED",
        },
        { status: 403 },
      );
    }

    const cd = await assertCooldownOk(supabase, deviceHash);
    if (!cd.ok) {
      return NextResponse.json(
        {
          error: "You can add one rent per 24 hours. Try again later.",
          code: "COOLDOWN",
          retryAfterSec: cd.retryAfterSec,
        },
        { status: 429 },
      );
    }
  } else {
    if (isBannedMemory(deviceHash)) {
      return NextResponse.json(
        {
          error:
            "Posting is disabled for this device after repeated reports on your submissions.",
          code: "BANNED",
        },
        { status: 403 },
      );
    }
    const cd = checkCooldownMemory(deviceHash);
    if (!cd.ok) {
      return NextResponse.json(
        {
          error: "You can add one rent per 24 hours. Try again later.",
          code: "COOLDOWN",
          retryAfterSec: cd.retryAfterSec,
        },
        { status: 429 },
      );
    }
  }

  if (supabase) {
    if (await hasRecentDuplicateInSupabase(supabase, deviceHash, lat, lng)) {
      return NextResponse.json(
        {
          error:
            "You already placed a pin here recently. Move the pin slightly or try again in a day or two.",
          code: "DUPLICATE_LOCATION",
          field: "general",
        },
        { status: 409 },
      );
    }
  } else if (hasRecentDuplicateMemory(deviceHash, lat, lng)) {
    return NextResponse.json(
      {
        error:
          "You already placed a pin here recently. Move the pin slightly or try again in a day or two.",
        code: "DUPLICATE_LOCATION",
        field: "general",
      },
      { status: 409 },
    );
  }

  const nearbyAmounts = await collectNearbyRentAmountsForMedian(
    lat,
    lng,
    bhk,
    supabase,
  );
  const regional = validateRentAgainstRegionalMedian(rent_inr, nearbyAmounts);
  if (!regional.ok) {
    return NextResponse.json(
      { error: regional.message, code: "OUTLIER", field: "rent" },
      { status: 422 },
    );
  }

  const localOnlyEntry = () => {
    const nowIso = new Date().toISOString();
    const entry = {
      id: `local-${Date.now()}`,
      lat,
      lng,
      rent_inr,
      bhk,
      area_label,
      move_in_month,
      broker_or_owner,
      furnishing,
      maintenance_inr,
      deposit_inr,
      opt_in_building_aggregate,
      women_only,
      created_at: nowIso,
      verification_status: "self-reported" as const,
      confirmations_count: 0,
      last_updated: nowIso,
    };
    registerLocalEntryAuthor(entry.id, deviceIdRaw);
    recordSubmission(deviceHash);
    recordSubmittedPinMemory(deviceHash, lat, lng);
    return entry;
  };

  if (!supabase) {
    const entry = localOnlyEntry();
    return NextResponse.json({ entry, persisted: false });
  }

  const fullRow = {
    lat,
    lng,
    rent_inr,
    bhk,
    area_label,
    move_in_month,
    broker_or_owner,
    furnishing,
    maintenance_inr,
    deposit_inr,
    opt_in_building_aggregate,
    women_only,
    device_id_hash: deviceHash,
  };

  const rowWithoutWomenOnly = {
    lat,
    lng,
    rent_inr,
    bhk,
    area_label,
    move_in_month,
    broker_or_owner,
    furnishing,
    maintenance_inr,
    deposit_inr,
    opt_in_building_aggregate,
    device_id_hash: deviceHash,
  };

  /** Core columns from 001_rent_entries.sql only (older DBs without extras / women_only). */
  const rowCoreOnly = {
    lat,
    lng,
    rent_inr,
    bhk,
    area_label,
    move_in_month,
    broker_or_owner,
    furnishing,
    device_id_hash: deviceHash,
  };

  type PgErr = { code?: string; message?: string; details?: string; hint?: string };
  const errText = (e: PgErr) =>
    `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();

  const looksLikeMissingWomenOnly = (e: PgErr) => {
    const t = errText(e);
    return t.includes("women_only") || (t.includes("column") && t.includes("women"));
  };

  const looksLikeMissingExtras = (e: PgErr) => {
    const t = errText(e);
    return (
      t.includes("maintenance_inr") ||
      t.includes("deposit_inr") ||
      t.includes("opt_in_building") ||
      t.includes("opt_in_building_aggregate")
    );
  };

  let { data, error } = await supabase
    .from("rent_entries")
    .insert(fullRow)
    .select()
    .single();

  if (error && looksLikeMissingWomenOnly(error as PgErr)) {
    console.warn("[rent_entries insert] retrying without women_only column");
    const r2 = await supabase
      .from("rent_entries")
      .insert(rowWithoutWomenOnly)
      .select()
      .single();
    data = r2.data;
    error = r2.error;
  }

  if (error && looksLikeMissingExtras(error as PgErr)) {
    console.warn("[rent_entries insert] retrying with core columns only");
    const r3 = await supabase
      .from("rent_entries")
      .insert(rowCoreOnly)
      .select()
      .single();
    data = r3.data;
    error = r3.error;
  }

  if (error) {
    const err = error as PgErr;
    console.error("[rent_entries insert] failed after retries", err.code, err.message, err.details);

    const msg = errText(err);
    if (err.code === "23505") {
      return NextResponse.json(
        {
          error: "This submission may already be on the map. Try refreshing.",
          code: "DUPLICATE",
          field: "general" as const,
        },
        { status: 409 },
      );
    }

    // Last resort: pin still appears for this user (local-only), avoids blocking UX.
    const entry = localOnlyEntry();
    return NextResponse.json({
      entry,
      persisted: false,
      syncWarning:
        msg.includes("permission") || msg.includes("rls") || err.code === "42501"
          ? "Saved on this device only. Ask your host to set SUPABASE_SERVICE_ROLE_KEY to the service_role secret (not the anon key) in Vercel env."
          : "Saved on this device only; cloud database could not be updated. Run Supabase migrations or check server logs.",
    });
  }

  recordSubmission(deviceHash);
  const entry = normalizeRentRow(data as Record<string, unknown>);

  return NextResponse.json({ entry, persisted: true });
}
