import type { RentEntry } from "@/types/rent";
import { distanceKm, median } from "@/lib/geo";
import { neighborsInRadius } from "@/lib/rent-engine";

export const ACTION_RADIUS_KM = 1.8;
/** Rent must be at least this much over median to show a "save by moving" CTA. */
export const OVERPRICED_THRESHOLD_PCT = 0.1; // 10%
/** Listings shown in "nearby" card — cap so we never flood the sheet. */
export const NEARBY_LIMIT = 6;

export type ActionInsights = {
  nearbyListings: RentEntry[];
  medianNearby: number | null;
  /** Number of comparable same-BHK pins used to derive the median. */
  sampleSize: number;
  /** Rent minus median (₹/month). Positive when overpriced. */
  overpricedBy: number;
  /** Percent over median (0-1). 0 when not meaningfully overpriced. */
  overpricedPct: number;
  cheapestNearby: RentEntry | null;
  /** When entry.broker_or_owner === 'Broker', surfaces nearby owner-listed pins. */
  ownerAlternatives: RentEntry[];
  hasBroker: boolean;
};

function recencyScore(e: RentEntry): number {
  const t = new Date(e.last_updated ?? e.created_at).getTime();
  if (Number.isNaN(t)) return 0;
  const daysAgo = Math.max(0, (Date.now() - t) / 86400000);
  return 1 / (1 + daysAgo / 30);
}

function confidenceBoost(e: RentEntry): number {
  if (e.verification_status === "verified_document") return 1.25;
  if (e.verification_status === "self-reported") return 1;
  return 0.85;
}

function rankNearby(entry: RentEntry, e: RentEntry): number {
  const d = distanceKm(entry.lat, entry.lng, e.lat, e.lng);
  const proximity = 1 / (1 + d);
  const verified = 1 + (e.confirmations_count ?? 0) * 0.05;
  return proximity * recencyScore(e) * confidenceBoost(e) * verified;
}

export function computeActionInsights(
  entry: RentEntry,
  allEntries: RentEntry[],
): ActionInsights {
  const sameBhkNearby = neighborsInRadius(
    entry,
    allEntries,
    ACTION_RADIUS_KM,
    true,
  );

  const ranked = [...sameBhkNearby].sort(
    (a, b) => rankNearby(entry, b) - rankNearby(entry, a),
  );
  const nearbyListings = ranked.slice(0, NEARBY_LIMIT);

  const rents = sameBhkNearby.map((e) => e.rent_inr);
  const medianNearby = rents.length >= 3 ? Math.round(median(rents)) : null;
  const sampleSize = rents.length;

  let overpricedBy = 0;
  let overpricedPct = 0;
  if (medianNearby && medianNearby > 0) {
    const diff = entry.rent_inr - medianNearby;
    const pct = diff / medianNearby;
    if (pct >= OVERPRICED_THRESHOLD_PCT) {
      overpricedBy = Math.round(diff);
      overpricedPct = pct;
    }
  }

  const cheaperCandidates = sameBhkNearby
    .filter((e) => e.rent_inr < entry.rent_inr)
    .sort((a, b) => a.rent_inr - b.rent_inr);
  const cheapestNearby = cheaperCandidates[0] ?? null;

  const hasBroker =
    (entry.broker_or_owner ?? "").toLowerCase().includes("broker");
  const ownerAlternatives = hasBroker
    ? sameBhkNearby
        .filter(
          (e) => (e.broker_or_owner ?? "").toLowerCase() === "owner",
        )
        .sort((a, b) => rankNearby(entry, b) - rankNearby(entry, a))
        .slice(0, 3)
    : [];

  return {
    nearbyListings,
    medianNearby,
    sampleSize,
    overpricedBy,
    overpricedPct,
    cheapestNearby,
    ownerAlternatives,
    hasBroker,
  };
}

/** Rough annualised ₹ savings if the user moved to the nearby median rent. */
export function annualSavings(monthlyDelta: number): number {
  return Math.max(0, Math.round(monthlyDelta * 12));
}
