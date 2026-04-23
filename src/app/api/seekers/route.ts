import { NextResponse } from "next/server";
import { hashDeviceId } from "@/lib/device-hash";
import {
  addSeekerMemory,
  checkSeekerCooldown,
  listSeekersMemory,
  recordSeekerSubmission,
} from "@/lib/seekers-memory";
import { getSupabaseService } from "@/lib/supabase/service";
import {
  SEEKER_BHK_PREF,
  SEEKER_FLATMATE_GENDER,
  SEEKER_FOOD_PREF,
  SEEKER_GENDER,
  SEEKER_LOOKING_FOR,
  SEEKER_MOVE_IN,
  SEEKER_SMOKE_PREF,
  type SeekerDraft,
  type SeekerPin,
} from "@/types/seeker";

export const dynamic = "force-dynamic";

type Field =
  | "looking_for"
  | "budget_inr"
  | "bhk_pref"
  | "move_in_timeline"
  | "food_pref"
  | "smoke_pref"
  | "self_gender"
  | "pref_flatmate_gender"
  | "lifestyle_note"
  | "email"
  | "phone"
  | "general";

function err(field: Field, message: string, status = 400, extra: object = {}) {
  return NextResponse.json({ error: message, field, ...extra }, { status });
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

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_DIGITS_RE = /^[0-9]{7,15}$/;

function validate(body: Record<string, unknown>):
  | { ok: true; draft: SeekerDraft }
  | { ok: false; response: NextResponse } {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { ok: false, response: err("general", "Invalid location. Reopen the form.") };
  }

  const looking_for = String(body.looking_for ?? "");
  if (!SEEKER_LOOKING_FOR.includes(looking_for as (typeof SEEKER_LOOKING_FOR)[number])) {
    return { ok: false, response: err("looking_for", "Pick Whole Flat or Room in a Flat.") };
  }

  const budget_inr = Math.round(Number(body.budget_inr));
  if (!Number.isFinite(budget_inr) || budget_inr < 1000 || budget_inr > 2_000_000) {
    return { ok: false, response: err("budget_inr", "Enter a realistic budget (₹1,000 – ₹20,00,000).") };
  }

  const bhk_pref = String(body.bhk_pref ?? "any");
  if (!SEEKER_BHK_PREF.includes(bhk_pref as (typeof SEEKER_BHK_PREF)[number])) {
    return { ok: false, response: err("bhk_pref", "Pick a BHK preference.") };
  }

  const move_in_timeline = String(body.move_in_timeline ?? "flexible");
  if (!SEEKER_MOVE_IN.includes(move_in_timeline as (typeof SEEKER_MOVE_IN)[number])) {
    return { ok: false, response: err("move_in_timeline", "Pick a move-in timeline.") };
  }

  const food_pref = String(body.food_pref ?? "any");
  if (!SEEKER_FOOD_PREF.includes(food_pref as (typeof SEEKER_FOOD_PREF)[number])) {
    return { ok: false, response: err("food_pref", "Pick a food preference or Any.") };
  }

  const smoke_raw = body.smoke_pref == null || body.smoke_pref === "" ? null : String(body.smoke_pref);
  if (smoke_raw != null && !SEEKER_SMOKE_PREF.includes(smoke_raw as (typeof SEEKER_SMOKE_PREF)[number])) {
    return { ok: false, response: err("smoke_pref", "Invalid smoker preference.") };
  }

  const self_raw = body.self_gender == null || body.self_gender === "" ? null : String(body.self_gender);
  if (self_raw != null && !SEEKER_GENDER.includes(self_raw as (typeof SEEKER_GENDER)[number])) {
    return { ok: false, response: err("self_gender", "Invalid gender selection.") };
  }

  const pref_flatmate_gender = String(body.pref_flatmate_gender ?? "any");
  if (!SEEKER_FLATMATE_GENDER.includes(pref_flatmate_gender as (typeof SEEKER_FLATMATE_GENDER)[number])) {
    return { ok: false, response: err("pref_flatmate_gender", "Pick a flatmate gender preference.") };
  }

  const lifestyle_note_raw = body.lifestyle_note == null ? "" : String(body.lifestyle_note).trim();
  if (lifestyle_note_raw.length > 500) {
    return { ok: false, response: err("lifestyle_note", "Keep lifestyle notes under 500 characters.") };
  }

  const email = String(body.email ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, response: err("email", "Enter a valid email address.") };
  }

  const phoneRaw = String(body.phone ?? "").trim();
  const phoneDigits = phoneRaw.replace(/[\s()\-+]/g, "");
  if (!PHONE_DIGITS_RE.test(phoneDigits)) {
    return { ok: false, response: err("phone", "Enter a valid phone number (7–15 digits).") };
  }

  const area_label =
    body.area_label == null || body.area_label === ""
      ? null
      : String(body.area_label).slice(0, 120);

  return {
    ok: true,
    draft: {
      lat,
      lng,
      area_label,
      looking_for: looking_for as SeekerDraft["looking_for"],
      budget_inr,
      bhk_pref: bhk_pref as SeekerDraft["bhk_pref"],
      move_in_timeline: move_in_timeline as SeekerDraft["move_in_timeline"],
      food_pref: food_pref as SeekerDraft["food_pref"],
      smoke_pref: smoke_raw as SeekerDraft["smoke_pref"],
      self_gender: self_raw as SeekerDraft["self_gender"],
      pref_flatmate_gender: pref_flatmate_gender as SeekerDraft["pref_flatmate_gender"],
      lifestyle_note: lifestyle_note_raw || null,
      email,
      phone: phoneRaw,
    },
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bbox = parseBbox(searchParams) ?? undefined;

  const supabase = getSupabaseService();
  if (!supabase) {
    return NextResponse.json({ seekers: listSeekersMemory(bbox) });
  }

  let q = supabase
    .from("seeker_pins_public")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);
  if (bbox) {
    q = q
      .gte("lat", bbox.minLat)
      .lte("lat", bbox.maxLat)
      .gte("lng", bbox.minLng)
      .lte("lng", bbox.maxLng);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({
      seekers: listSeekersMemory(bbox),
      note: "db_unavailable",
    });
  }
  return NextResponse.json({ seekers: (data ?? []) as SeekerPin[] });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("general", "Invalid JSON", 400);
  }

  const parsed = validate(body);
  if (!parsed.ok) return parsed.response;
  const draft = parsed.draft;

  const deviceIdRaw = req.headers.get("x-device-id") ?? "anon";
  const deviceHash = hashDeviceId(deviceIdRaw);
  const ipHash = hashDeviceId(getClientIp(req));

  const cd = checkSeekerCooldown(deviceHash);
  if (!cd.ok) {
    return NextResponse.json(
      {
        error: "You recently dropped a Seeker Pin. Try again in a bit.",
        code: "COOLDOWN",
        field: "general",
        retryAfterSec: cd.retryAfterSec,
      },
      { status: 429 },
    );
  }

  const supabase = getSupabaseService();

  if (!supabase) {
    const seeker = addSeekerMemory(draft, deviceHash, ipHash);
    recordSeekerSubmission(deviceHash);
    return NextResponse.json({ seeker, persisted: false });
  }

  const row = {
    lat: draft.lat,
    lng: draft.lng,
    area_label: draft.area_label,
    looking_for: draft.looking_for,
    budget_inr: draft.budget_inr,
    bhk_pref: draft.bhk_pref,
    move_in_timeline: draft.move_in_timeline,
    food_pref: draft.food_pref,
    smoke_pref: draft.smoke_pref,
    self_gender: draft.self_gender,
    pref_flatmate_gender: draft.pref_flatmate_gender,
    lifestyle_note: draft.lifestyle_note,
    email: draft.email,
    phone: draft.phone,
    device_id_hash: deviceHash,
    ip_hash: ipHash,
  };

  const { data, error } = await supabase
    .from("seeker_pins")
    .insert(row)
    .select(
      "id, lat, lng, area_label, looking_for, budget_inr, bhk_pref, move_in_timeline, food_pref, smoke_pref, self_gender, pref_flatmate_gender, lifestyle_note, created_at, status",
    )
    .single();

  if (error) {
    console.error("[seeker_pins insert] failed:", error.code, error.message);
    const seeker = addSeekerMemory(draft, deviceHash, ipHash);
    recordSeekerSubmission(deviceHash);
    return NextResponse.json({
      seeker,
      persisted: false,
      syncWarning:
        "Saved on this device only. Apply migration 007_seeker_pins.sql and verify SUPABASE_SERVICE_ROLE_KEY is set to the service_role secret.",
    });
  }

  recordSeekerSubmission(deviceHash);
  return NextResponse.json({ seeker: data as SeekerPin, persisted: true });
}
