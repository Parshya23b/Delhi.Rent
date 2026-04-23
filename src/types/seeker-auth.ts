/** Matches Postgres enums from migration 012. */

export const SEEKER_INTENT = ["whole_flat", "room"] as const;
export type SeekerIntent = (typeof SEEKER_INTENT)[number];

export const SEEKER_MOVE_IN = ["asap", "next_month", "flexible"] as const;
export type SeekerMoveIn = (typeof SEEKER_MOVE_IN)[number];

export const SEEKER_FOOD = ["veg", "non_veg", "any"] as const;
export type SeekerFood = (typeof SEEKER_FOOD)[number];

export const SEEKER_SMOKING = ["smoker", "non_smoker", "no_preference"] as const;
export type SeekerSmoking = (typeof SEEKER_SMOKING)[number];

export const SEEKER_GENDER = ["male", "female", "other"] as const;
export type SeekerGender = (typeof SEEKER_GENDER)[number];

export const SEEKER_PREF_GENDER = ["male", "female", "any"] as const;
export type SeekerPrefGender = (typeof SEEKER_PREF_GENDER)[number];

export const SEEKER_SLEEP = ["early", "late", "flexible"] as const;
export type SeekerSleep = (typeof SEEKER_SLEEP)[number];

export const SEEKER_WORK = ["wfh", "office", "hybrid"] as const;
export type SeekerWork = (typeof SEEKER_WORK)[number];

export const SEEKER_SOCIAL = ["quiet", "moderate", "social"] as const;
export type SeekerSocial = (typeof SEEKER_SOCIAL)[number];

export const SEEKER_CLEANLINESS = ["low", "medium", "high"] as const;
export type SeekerCleanliness = (typeof SEEKER_CLEANLINESS)[number];

export type CreateSeekerPinBody = {
  lat: number;
  lng: number;
  radius_km?: number;
  intent_type: SeekerIntent;
  budget: number;
  bhk_preference?: number | null;
  move_in?: SeekerMoveIn;
  preferences: {
    food_pref?: SeekerFood;
    smoking_pref?: SeekerSmoking;
    gender: SeekerGender;
    preferred_gender?: SeekerPrefGender;
    sleep_pattern?: SeekerSleep;
    work_type?: SeekerWork;
    social_level?: SeekerSocial;
    cleanliness_level?: SeekerCleanliness;
  };
};
