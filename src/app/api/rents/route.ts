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
import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import { SUBMISSION_COOLDOWN_MS } from "@/lib/rent-policy";
import { getSupabaseRead, getSupabaseService } from "@/lib/supabase/service";
import {
  checkCooldownMemory,
  recordSubmission,
} from "@/lib/submission-cooldown";
import { BHK_OPTIONS, bhkCodeToLabel } from "@/types/rent";

export const dynamic = "force-dynamic";

function parseOptionalNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseRequiredFiniteNumber(v: unknown): number {
  if (v == null || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function parseBhkToLabel(body: Record<string, unknown>): string {
  const raw = body.bhk;
  if (raw == null || raw === "") return "";
  const asNum = Number(raw);
  if (Number.isInteger(asNum)) {
    const label = bhkCodeToLabel(asNum);
    if (label) return label;
  }
  const s = String(raw).trim();
  if ((BHK_OPTIONS as readonly string[]).includes(s)) return s;
  return "";
}

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
    .from(RENT_ENTRIES_EXPANDED)
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

  const lat = parseRequiredFiniteNumber(body.lat);
  const lng = parseRequiredFiniteNumber(body.lng);
  const rent_inr = (() => {
    const n = parseOptionalNumber(body.rent ?? body.rent_inr);
    return n == null ? NaN : n;
  })();
  const bhk = parseBhkToLabel(body);
  const area_label = body.area_label != null ? String(body.area_label) : null;
  const move_in_month =
    body.move_in_month != null ? String(body.move_in_month) : null;
  const broker_or_owner =
    body.broker_or_owner != null ? String(body.broker_or_owner) : null;
  const furnishing = body.furnishing != null ? String(body.furnishing) : null;
  const maintenance_inr = parseOptionalNumber(body.maintenance_inr);
  const deposit_inr = parseOptionalNumber(body.deposit_inr);
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
    getSupabaseRead(),
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
    console.warn(
      "[POST /api/rents] No Supabase service client — DB insert skipped. Set SUPABASE_SERVICE_ROLE_KEY (service_role secret, not anon) for persisted pins.",
    );
    const entry = localOnlyEntry();
    return NextResponse.json({ entry, persisted: false });
  }

  type PgErr = { code?: string; message?: string; details?: string; hint?: string };
  const errText = (e: PgErr) =>
    `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();

  const logSupabaseError = (label: string, err: PgErr | null) => {
    if (!err) {
      console.error(label, { message: "unknown (no error object)" });
      return;
    }
    console.error(label, {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint,
    });
  };

  const isRlsOrPermission = (err: PgErr | null) => {
    if (!err) return false;
    const t = errText(err);
    return (
      err.code === "42501" ||
      t.includes("permission") ||
      t.includes("rls") ||
      t.includes("row-level security")
    );
  };

  const brokerLower = (broker_or_owner ?? "").toLowerCase();
  const sourceType =
    brokerLower.includes("broker") ? "broker"
    : brokerLower.includes("owner") ? "owner"
    : "user";

  const areaLabelTrim = (area_label ?? "").trim() || "Pin";

  const areaPayload = { label: areaLabelTrim, lat, lng };
  console.log("[POST /api/rents] areas.insert payload", areaPayload);

  const { data: areaRow, error: areaErr } = await supabase
    .from("areas")
    .insert(areaPayload)
    .select("id, label, lat, lng, created_at")
    .single();

  console.log("[POST /api/rents] areas.insert response", {
    ok: !areaErr,
    data: areaRow,
    error: areaErr,
  });

  if (areaErr || !areaRow) {
    console.error("[POST /api/rents] areas.insert failed", areaErr);
    const entry = localOnlyEntry();
    return NextResponse.json({
      entry,
      persisted: false,
      syncWarning:
        "Saved on this device only; could not create map area in the database.",
    });
  }

  const furnishingVal =
    furnishing != null && String(furnishing).trim() !== ""
      ? String(furnishing).trim()
      : null;

  const rentEntryPayload = {
    area_id: areaRow.id as string,
    rent: rent_inr,
    bhk,
    furnishing: furnishingVal,
  };
  console.log("[POST /api/rents] rent_entries.insert payload", {
    ...rentEntryPayload,
    /** Map coordinates live on `areas`; included here for debugging only. */
    _map_lat: lat,
    _map_lng: lng,
  });

  const { data: rentRow, error: rentErr } = await supabase
    .from("rent_entries")
    .insert([rentEntryPayload])
    .select("id, area_id, rent, bhk, furnishing, created_at")
    .single();

  console.log("[POST /api/rents] rent_entries.insert response", {
    ok: !rentErr,
    data: rentRow,
    error: rentErr,
  });

  if (rentErr || !rentRow) {
    logSupabaseError("[POST /api/rents] rent_entries.insert failed", rentErr as PgErr | null);
    await supabase.from("areas").delete().eq("id", areaRow.id as string);
    const err = rentErr as PgErr | null;
    if (err?.code === "23505") {
      return NextResponse.json(
        {
          error: "This submission may already be on the map. Try refreshing.",
          code: "DUPLICATE",
          field: "general" as const,
        },
        { status: 409 },
      );
    }
    const rls = isRlsOrPermission(err);
    return NextResponse.json(
      {
        error: rls
          ? "Database rejected this write (permissions). Ensure the API uses SUPABASE_SERVICE_ROLE_KEY (service_role), not the anon key."
          : "Could not save this rent pin to the database. Try again in a moment.",
        code: rls ? "RLS_OR_PERMISSION" : "RENT_INSERT_FAILED",
        field: "general" as const,
        ...(process.env.NODE_ENV === "development" && err?.message
          ? { details: err.message }
          : {}),
      },
      { status: rls ? 503 : 502 },
    );
  }

  const rentId = String((rentRow as { id: string }).id);
  console.log("[POST /api/rents] rent_entries.insert confirmed", {
    rent_entry_id: rentId,
    area_id: areaRow.id,
  });

  const { error: srcErr } = await supabase.from("rent_sources").insert({
    rent_entry_id: rentId,
    source_type: sourceType,
    confidence_score: sourceType === "user" ? 50 : 60,
    verified: false,
    submitter_device_hash: deviceHash,
  });

  if (srcErr) {
    console.error("[rent_sources insert]", srcErr);
    await supabase.from("rent_entries").delete().eq("id", rentId);
    await supabase.from("areas").delete().eq("id", areaRow.id as string);
    const entry = localOnlyEntry();
    return NextResponse.json({
      entry,
      persisted: false,
      syncWarning:
        "Saved on this device only; could not attach source metadata to this pin.",
    });
  }

  const rollbackWrittenPin = async () => {
    await supabase.from("rent_sources").delete().eq("rent_entry_id", rentId);
    await supabase.from("rent_entries").delete().eq("id", rentId);
    await supabase.from("areas").delete().eq("id", areaRow.id as string);
  };

  // Mirrors: SELECT * FROM rent_entries ORDER BY created_at DESC LIMIT 5;
  const { data: recentFive, error: recentFiveErr } = await supabase
    .from("rent_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentFiveErr) {
    logSupabaseError(
      "[POST /api/rents] rent_entries post-submit verify (ORDER BY created_at DESC LIMIT 5) failed",
      recentFiveErr as PgErr,
    );
    await rollbackWrittenPin();
    return NextResponse.json(
      {
        error: "Pin could not be verified after save. Nothing was kept.",
        code: "RENT_ENTRIES_VERIFY_FAILED",
        field: "general" as const,
        ...(process.env.NODE_ENV === "development" && (recentFiveErr as PgErr).message
          ? { details: (recentFiveErr as PgErr).message }
          : {}),
      },
      { status: 502 },
    );
  }

  if (!recentFive?.length) {
    console.error("[POST /api/rents] rent_entries post-submit verify: no rows returned (expected at least new pin)");
    await rollbackWrittenPin();
    return NextResponse.json(
      {
        error: "Pin could not be verified after save. Nothing was kept.",
        code: "RENT_ENTRIES_VERIFY_EMPTY",
        field: "general" as const,
      },
      { status: 502 },
    );
  }

  const { data: rowById, error: rowByIdErr } = await supabase
    .from("rent_entries")
    .select("*")
    .eq("id", rentId)
    .maybeSingle();

  if (rowByIdErr || !rowById) {
    logSupabaseError(
      "[POST /api/rents] rent_entries post-submit verify (SELECT by id) failed",
      rowByIdErr as PgErr | null,
    );
    await rollbackWrittenPin();
    return NextResponse.json(
      {
        error: "Pin could not be re-read after save. Nothing was kept.",
        code: "RENT_ENTRIES_VERIFY_BY_ID_FAILED",
        field: "general" as const,
      },
      { status: 502 },
    );
  }

  const inLatestSample = recentFive.some((r) => String(r.id) === rentId);
  if (!inLatestSample) {
    console.warn("[POST /api/rents] rent_entries: saved row exists but was not in latest-5 sample", {
      rent_entry_id: rentId,
      sampleIds: recentFive.map((r) => r.id),
    });
  }

  console.log("[POST /api/rents] rent_entries post-submit verify OK", {
    rent_entry_id: rentId,
    latestSampleCount: recentFive.length,
    sampleIds: recentFive.map((r) => r.id),
    inLatestFiveSample: inLatestSample,
  });

  const { data: full, error: fullErr } = await supabase
    .from(RENT_ENTRIES_EXPANDED)
    .select("*")
    .eq("id", rentId)
    .maybeSingle();

  if (fullErr || !full) {
    console.error("[rent_entries_expanded read]", fullErr);
    const entry = localOnlyEntry();
    return NextResponse.json({
      entry,
      persisted: false,
      syncWarning: "Saved on this device only; pin was written but could not be reloaded.",
    });
  }

  recordSubmission(deviceHash);
  recordSubmittedPinMemory(deviceHash, lat, lng);
  const entry = normalizeRentRow(full as Record<string, unknown>);

  console.log("[POST /api/rents] persist OK", {
    rent_entry_id: rentId,
    area_id: areaRow.id,
    persisted: true,
    insertConfirmed: true,
  });

  return NextResponse.json({
    entry,
    persisted: true,
    insertConfirmed: true,
    ids: { rent_entry_id: rentId, area_id: String(areaRow.id) },
  });
}
