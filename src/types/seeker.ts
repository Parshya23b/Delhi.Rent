export const SEEKER_LOOKING_FOR = ["whole_flat", "room_in_flat"] as const;
export type SeekerLookingFor = (typeof SEEKER_LOOKING_FOR)[number];

export const SEEKER_BHK_PREF = ["1BHK", "2BHK", "3BHK", "any"] as const;
export type SeekerBhkPref = (typeof SEEKER_BHK_PREF)[number];

export const SEEKER_MOVE_IN = ["asap", "next_month", "flexible"] as const;
export type SeekerMoveIn = (typeof SEEKER_MOVE_IN)[number];

export const SEEKER_FOOD_PREF = ["veg", "non_veg", "any"] as const;
export type SeekerFoodPref = (typeof SEEKER_FOOD_PREF)[number];

export const SEEKER_SMOKE_PREF = [
  "smoker",
  "non_smoker",
  "no_preference",
] as const;
export type SeekerSmokePref = (typeof SEEKER_SMOKE_PREF)[number];

export const SEEKER_GENDER = ["male", "female", "other"] as const;
export type SeekerGender = (typeof SEEKER_GENDER)[number];

export const SEEKER_FLATMATE_GENDER = ["male", "female", "any"] as const;
export type SeekerFlatmateGender = (typeof SEEKER_FLATMATE_GENDER)[number];

export interface SeekerPin {
  id: string;
  lat: number;
  lng: number;
  area_label: string | null;
  looking_for: SeekerLookingFor;
  budget_inr: number;
  bhk_pref: SeekerBhkPref;
  move_in_timeline: SeekerMoveIn;
  food_pref: SeekerFoodPref;
  smoke_pref: SeekerSmokePref | null;
  self_gender: SeekerGender | null;
  pref_flatmate_gender: SeekerFlatmateGender;
  lifestyle_note: string | null;
  /** Private — never returned by public GET responses. */
  email?: string | null;
  /** Private — never returned by public GET responses. */
  phone?: string | null;
  created_at: string;
  status: "active" | "archived";
}

/** The payload shape we send from the browser to POST /api/seekers. */
export interface SeekerDraft {
  lat: number;
  lng: number;
  area_label: string | null;
  looking_for: SeekerLookingFor;
  budget_inr: number;
  bhk_pref: SeekerBhkPref;
  move_in_timeline: SeekerMoveIn;
  food_pref: SeekerFoodPref;
  smoke_pref: SeekerSmokePref | null;
  self_gender: SeekerGender | null;
  pref_flatmate_gender: SeekerFlatmateGender;
  lifestyle_note: string | null;
  email: string;
  phone: string;
}
