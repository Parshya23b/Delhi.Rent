export const BHK_OPTIONS = ["1RK", "1BHK", "2BHK", "3BHK", "4BHK+"] as const;
export type BHKType = (typeof BHK_OPTIONS)[number];

export const FURNISHING_OPTIONS = [
  "Unfurnished",
  "Semi-furnished",
  "Fully furnished",
] as const;
export type FurnishingType = (typeof FURNISHING_OPTIONS)[number];

export type ConfidenceLevel = "high" | "medium" | "low";

export const VERIFICATION_STATUSES = [
  "unverified",
  "self-reported",
  "verified_document",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface RentEntry {
  id: string;
  lat: number;
  lng: number;
  rent_inr: number;
  bhk: string;
  area_label: string | null;
  move_in_month: string | null;
  broker_or_owner: string | null;
  furnishing: string | null;
  maintenance_inr: number | null;
  deposit_inr: number | null;
  opt_in_building_aggregate: boolean;
  /** Female-hosted / women-only listing (self-reported; map filter). */
  women_only?: boolean;
  created_at: string;
  /** Trust level shown as colored badge (grey/yellow/green). */
  verification_status?: VerificationStatus;
  /** Count of unique devices that confirmed this pin still accurate. */
  confirmations_count?: number;
  /** Bumps on author edit or user confirmation. */
  last_updated?: string;
  /** Present when computed client-side or from API enrichment */
  confidence?: ConfidenceLevel;
  cluster_verified?: boolean;
  confidence_score?: number;
}

export interface AreaStats {
  count: number;
  average: number;
  median: number;
  min: number;
  max: number;
  /** Rounded “typical” rent people report most often in this slice */
  most_common_bucket_inr: number;
  label: string;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  clusterVerified: boolean;
  score: number; // 0–100
  reason: string;
}
