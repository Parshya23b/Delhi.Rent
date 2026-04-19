import type {
  AreaStats,
  ConfidenceLevel,
  ConfidenceResult,
  RentEntry,
} from "@/types/rent";
import { distanceKm, isOutlierIqr, median } from "@/lib/geo";

const NEARBY_KM = 2;
const CLUSTER_KM = 0.5;
const SIMILAR_PCT = 0.22;

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function neighborsInRadius(
  center: RentEntry,
  all: RentEntry[],
  radiusKm: number,
  sameBhk?: boolean,
): RentEntry[] {
  return all.filter((e) => {
    if (e.id === center.id) return false;
    if (sameBhk && e.bhk !== center.bhk) return false;
    return distanceKm(center.lat, center.lng, e.lat, e.lng) <= radiusKm;
  });
}

export function computeConfidence(
  entry: RentEntry,
  allEntries: RentEntry[],
): ConfidenceResult {
  const nearbySame = neighborsInRadius(entry, allEntries, NEARBY_KM, true);
  const nearbyAny = neighborsInRadius(entry, allEntries, NEARBY_KM, false);
  const rentsSame = nearbySame.map((e) => e.rent_inr);

  const clusterPeers = nearbySame.filter((e) => {
    const d = distanceKm(entry.lat, entry.lng, e.lat, e.lng);
    if (d > CLUSTER_KM) return false;
    const lo = entry.rent_inr * (1 - SIMILAR_PCT);
    const hi = entry.rent_inr * (1 + SIMILAR_PCT);
    return e.rent_inr >= lo && e.rent_inr <= hi;
  });

  const clusterVerified = clusterPeers.length >= 3;
  const outlier =
    rentsSame.length >= 4 && isOutlierIqr(entry.rent_inr, rentsSame);
  const cv = coefficientOfVariation(
    rentsSame.length ? rentsSame : [entry.rent_inr],
  );

  let score = 40;
  if (nearbySame.length >= 8) score += 25;
  else if (nearbySame.length >= 4) score += 18;
  else if (nearbySame.length >= 2) score += 10;

  if (nearbyAny.length >= 12) score += 10;
  else if (nearbyAny.length >= 6) score += 5;

  if (clusterVerified) score += 20;
  if (outlier) score -= 25;
  if (cv > 0.35 && rentsSame.length >= 3) score -= 12;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: ConfidenceLevel = "low";
  if (score >= 70) level = "high";
  else if (score >= 40) level = "medium";

  let reason = "Few comparable listings nearby.";
  if (clusterVerified) reason = "Cluster verified: several similar rents close by.";
  else if (nearbySame.length >= 4 && !outlier)
    reason = "Aligned with nearby rents for this configuration.";
  else if (outlier) reason = "This amount differs from nearby similar listings.";

  return { level, clusterVerified, score, reason };
}

export function computeAreaStats(
  entries: RentEntry[],
  areaName: string,
): AreaStats | null {
  if (entries.length === 0) return null;
  const rents = entries.map((e) => e.rent_inr).sort((a, b) => a - b);
  const sum = rents.reduce((a, b) => a + b, 0);
  const average = Math.round(sum / rents.length);
  const med = median(rents.map(Number));
  const min = rents[0]!;
  const max = rents[rents.length - 1]!;

  const bucket = 5000;
  const buckets = new Map<number, number>();
  for (const r of rents) {
    const k = Math.round(r / bucket) * bucket;
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let most_common_bucket_inr = med;
  let best = 0;
  for (const [k, c] of buckets) {
    if (c > best) {
      best = c;
      most_common_bucket_inr = k;
    }
  }

  return {
    count: entries.length,
    average,
    median: Math.round(med),
    min,
    max,
    most_common_bucket_inr,
    label: areaName,
  };
}

export function entriesNearPoint(
  lat: number,
  lng: number,
  all: RentEntry[],
  radiusKm: number,
  bhk?: string,
): RentEntry[] {
  return all.filter((e) => {
    if (bhk && e.bhk !== bhk) return false;
    return distanceKm(lat, lng, e.lat, e.lng) <= radiusKm;
  });
}

export function overpayPercent(userRent: number, areaMedian: number): number {
  if (areaMedian <= 0) return 0;
  return Math.round(((userRent - areaMedian) / areaMedian) * 100);
}
