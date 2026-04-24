import { distanceKm } from "@/lib/geo";
import type { RentEntry } from "@/types/rent";

/** Seeker side of the match (lat/lng + budget + optional BHK + search radius). */
export type SeekerMatchInput = {
  lat: number;
  lng: number;
  budget: number;
  /** Same as `seeker_pins.radius_km` (km). Defaults to 2. */
  radius_km?: number;
  /** Same as `bhk_preference`: leading digit in rent `bhk` label; null = any. */
  bhk: number | null;
};

export type SeekerRentMatch = {
  entry: RentEntry;
  distance_km: number;
  /** Combined score in [0, 1], higher is better. */
  score: number;
  proximity_score: number;
  price_score: number;
};

export type MatchSeekerOptions = {
  limit?: number;
};

const DEFAULT_RADIUS_KM = 2;
const DEFAULT_LIMIT = 50;

/** First integer in strings like `2BHK`, `1RK` (same idea as `014_match_seeker_rpc.sql`). */
export function rentBhkLeadingNumber(bhkLabel: string): number | null {
  const m = String(bhkLabel).toLowerCase().trim().match(/(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

function bhkMatches(seekerBhk: number | null, rentBhkLabel: string): boolean {
  if (seekerBhk === null) return true;
  const n = rentBhkLeadingNumber(rentBhkLabel);
  if (n === null) return false;
  return n === seekerBhk;
}

/** Higher when closer to the seeker; soft edge at 1.5× radius (mirrors SQL weights). */
function proximityScore(distKm: number, radiusKm: number): number {
  if (radiusKm <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - distKm / (radiusKm * 1.5)));
}

/** Higher when rent is near seeker budget (tolerates band via denominator). */
function priceScore(rentInr: number, budget: number): number {
  const denom = Math.max(budget * 0.35, 5000);
  return Math.max(0, Math.min(1, 1 - Math.abs(rentInr - budget) / denom));
}

function combinedScore(proximity: number, price: number): number {
  return Math.max(0, Math.min(1, 0.5 * proximity + 0.5 * price));
}

/**
 * Rank {@link RentEntry} rows for a seeker: within radius, rent ≤ budget, optional BHK match;
 * scores by proximity and price fit; returns highest-scoring rows first.
 */
export function matchSeeker(
  seeker: SeekerMatchInput,
  rentEntries: RentEntry[],
  options?: MatchSeekerOptions,
): SeekerRentMatch[] {
  const radiusKm =
    seeker.radius_km != null && Number.isFinite(seeker.radius_km) && seeker.radius_km > 0
      ? seeker.radius_km
      : DEFAULT_RADIUS_KM;
  const limit =
    options?.limit != null && Number.isFinite(options.limit) && options.limit > 0
      ? Math.floor(options.limit)
      : DEFAULT_LIMIT;

  const out: SeekerRentMatch[] = [];

  for (const entry of rentEntries) {
    if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) continue;
    const dist = distanceKm(seeker.lat, seeker.lng, entry.lat, entry.lng);
    if (dist > radiusKm) continue;
    if (!Number.isFinite(entry.rent_inr) || entry.rent_inr > seeker.budget) continue;
    if (!bhkMatches(seeker.bhk, entry.bhk)) continue;

    const proximity = proximityScore(dist, radiusKm);
    const price = priceScore(entry.rent_inr, seeker.budget);
    const score = combinedScore(proximity, price);

    out.push({
      entry,
      distance_km: dist,
      score,
      proximity_score: proximity,
      price_score: price,
    });
  }

  out.sort((a, b) => {
    const d = b.score - a.score;
    if (d !== 0) return d;
    return a.entry.id.localeCompare(b.entry.id);
  });

  const top = out.slice(0, limit);
  console.log("[matchSeeker]", {
    rentPoolSize: rentEntries.length,
    matchCount: top.length,
    radiusKm,
    budget: seeker.budget,
    bhk: seeker.bhk,
  });
  return top;
}
