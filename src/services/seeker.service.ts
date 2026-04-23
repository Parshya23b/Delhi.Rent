import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateSeekerPinBody } from "@/types/seeker-auth";
import {
  SEEKER_CLEANLINESS,
  SEEKER_FOOD,
  SEEKER_GENDER,
  SEEKER_INTENT,
  SEEKER_MOVE_IN,
  SEEKER_PREF_GENDER,
  SEEKER_SLEEP,
  SEEKER_SMOKING,
  SEEKER_SOCIAL,
  SEEKER_WORK,
} from "@/types/seeker-auth";

export class SeekerServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "SeekerServiceError";
  }
}

function assert(cond: unknown, code: string, message: string, status = 400): asserts cond {
  if (!cond) throw new SeekerServiceError(code, message, status);
}

export async function createSeekerPinWithPreferences(
  supabase: SupabaseClient,
  body: CreateSeekerPinBody,
  /** Set by middleware after JWT validation (avoids a second auth.getUser round-trip). */
  userId: string,
) {
  assert(
    typeof userId === "string" && userId.length > 0,
    "UNAUTHORIZED",
    "Missing authenticated user.",
    401,
  );

  assert(
    typeof body.lat === "number" && body.lat >= -90 && body.lat <= 90,
    "VALIDATION",
    "lat must be between -90 and 90.",
  );
  assert(
    typeof body.lng === "number" && body.lng >= -180 && body.lng <= 180,
    "VALIDATION",
    "lng must be between -180 and 180.",
  );
  assert(SEEKER_INTENT.includes(body.intent_type), "VALIDATION", "intent_type must be whole_flat or room.");
  assert(typeof body.budget === "number" && body.budget >= 0, "VALIDATION", "budget must be a non-negative number.");

  const radius =
    body.radius_km === undefined ? 2 : Math.round(Number(body.radius_km));
  assert(radius > 0 && radius <= 100, "VALIDATION", "radius_km must be between 1 and 100.");

  const moveIn = body.move_in ?? "flexible";
  assert(SEEKER_MOVE_IN.includes(moveIn), "VALIDATION", "Invalid move_in.");

  const bhk =
    body.bhk_preference === undefined || body.bhk_preference === null
      ? null
      : Number(body.bhk_preference);
  if (bhk !== null) {
    assert(
      Number.isInteger(bhk) && bhk >= 0 && bhk <= 10,
      "VALIDATION",
      "bhk_preference must be an integer 0–10 or null.",
    );
  }

  const p = body.preferences;
  assert(p && typeof p === "object", "VALIDATION", "preferences object is required.");
  assert(SEEKER_GENDER.includes(p.gender), "VALIDATION", "preferences.gender is invalid.");

  const food = p.food_pref ?? "any";
  const smoke = p.smoking_pref ?? "no_preference";
  const prefG = p.preferred_gender ?? "any";
  const sleep = p.sleep_pattern ?? "flexible";
  const work = p.work_type ?? "hybrid";
  const social = p.social_level ?? "moderate";
  const clean = p.cleanliness_level ?? "medium";

  assert(SEEKER_FOOD.includes(food), "VALIDATION", "preferences.food_pref is invalid.");
  assert(SEEKER_SMOKING.includes(smoke), "VALIDATION", "preferences.smoking_pref is invalid.");
  assert(SEEKER_PREF_GENDER.includes(prefG), "VALIDATION", "preferences.preferred_gender is invalid.");
  assert(SEEKER_SLEEP.includes(sleep), "VALIDATION", "preferences.sleep_pattern is invalid.");
  assert(SEEKER_WORK.includes(work), "VALIDATION", "preferences.work_type is invalid.");
  assert(SEEKER_SOCIAL.includes(social), "VALIDATION", "preferences.social_level is invalid.");
  assert(SEEKER_CLEANLINESS.includes(clean), "VALIDATION", "preferences.cleanliness_level is invalid.");

  const pinRow = {
    user_id: userId,
    lat: body.lat,
    lng: body.lng,
    radius_km: radius,
    intent_type: body.intent_type,
    budget: Math.round(body.budget),
    bhk_preference: bhk,
    move_in: moveIn,
    is_active: true,
  };

  const { data: pin, error: pinErr } = await supabase
    .from("seeker_pins")
    .insert(pinRow)
    .select("id, user_id, lat, lng, radius_km, intent_type, budget, bhk_preference, move_in, is_active, created_at")
    .single();

  if (pinErr || !pin) {
    const code = pinErr?.code;
    if (code === "23505") {
      throw new SeekerServiceError(
        "DUPLICATE_LOCATION",
        "You already have a seeker pin at this location (rounded coordinates).",
        409,
        pinErr,
      );
    }
    if (code === "23514" || (pinErr?.message ?? "").toLowerCase().includes("maximum 3 pins")) {
      throw new SeekerServiceError(
        "PIN_LIMIT",
        "Maximum of 3 seeker pins per account.",
        403,
        pinErr,
      );
    }
    throw new SeekerServiceError(
      "PIN_CREATE_FAILED",
      pinErr?.message ?? "Could not create seeker pin.",
      400,
      pinErr,
    );
  }

  const prefRow = {
    seeker_id: pin.id,
    food_pref: food,
    smoking_pref: smoke,
    gender: p.gender,
    preferred_gender: prefG,
    sleep_pattern: sleep,
    work_type: work,
    social_level: social,
    cleanliness_level: clean,
  };

  const { data: pref, error: prefErr } = await supabase
    .from("seeker_preferences")
    .insert(prefRow)
    .select(
      "id, seeker_id, food_pref, smoking_pref, gender, preferred_gender, sleep_pattern, work_type, social_level, cleanliness_level",
    )
    .single();

  if (prefErr || !pref) {
    await supabase.from("seeker_pins").delete().eq("id", pin.id);
    throw new SeekerServiceError(
      "PREFERENCES_CREATE_FAILED",
      prefErr?.message ?? "Could not save preferences.",
      400,
      prefErr,
    );
  }

  return { pin, preferences: pref };
}

export async function runMatchSeeker(supabase: SupabaseClient, seekerPinId: string) {
  assert(
    typeof seekerPinId === "string" && seekerPinId.length > 0,
    "VALIDATION",
    "seeker_id (pin uuid) is required.",
  );

  const { data, error } = await supabase.rpc("match_seeker", { seeker_id: seekerPinId });
  if (error) {
    const msg = error.message ?? "match_seeker failed";
    const lower = msg.toLowerCase();
    const status =
      lower.includes("not allowed") || lower.includes("authentication required")
        ? 403
        : lower.includes("not found")
          ? 404
          : 400;
    throw new SeekerServiceError("MATCH_FAILED", msg, status, error);
  }

  return data as unknown;
}

export async function listMatchesForSeeker(supabase: SupabaseClient, seekerPinId: string) {
  assert(
    typeof seekerPinId === "string" && seekerPinId.length > 0,
    "VALIDATION",
    "seeker_id query parameter (pin uuid) is required.",
  );

  const { data, error } = await supabase
    .from("matches")
    .select("id, seeker_id, property_id, matched_user_id, match_score, status, created_at")
    .eq("seeker_id", seekerPinId)
    .order("match_score", { ascending: false });

  if (error) {
    throw new SeekerServiceError("LIST_MATCHES_FAILED", error.message, 400, error);
  }

  return data ?? [];
}
