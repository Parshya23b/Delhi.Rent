import { distanceKm } from "@/lib/geo";
import type { RentEntry } from "@/types/rent";

const CELL_KM = 0.04; // ~40m
const RENT_SIMILARITY = 0.18;

function cellKey(lat: number, lng: number): string {
  const gy = Math.round(lat / CELL_KM);
  const gx = Math.round(lng / CELL_KM);
  return `${gx}:${gy}`;
}

export type BuildingCluster = {
  key: string;
  count: number;
  medianRent: number;
  bhkMix: string;
};

/** Groups opt-in pins that are close + similar rent into fuzzy “building” buckets */
export function computeBuildingClusters(
  entries: RentEntry[],
): BuildingCluster[] {
  const groups = new Map<string, RentEntry[]>();
  const optIn = entries.filter((e) => e.opt_in_building_aggregate);
  for (const e of optIn) {
    const k = cellKey(e.lat, e.lng);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const out: BuildingCluster[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const rents = list.map((x) => x.rent_inr).sort((a, b) => a - b);
    const med = rents[Math.floor(rents.length / 2)]!;
    const coherent = list.filter((e) => {
      const lo = med * (1 - RENT_SIMILARITY);
      const hi = med * (1 + RENT_SIMILARITY);
      return e.rent_inr >= lo && e.rent_inr <= hi;
    });
    if (coherent.length < 3) continue;
    const near = coherent.filter((a) =>
      coherent.every(
        (b) =>
          a === b ||
          distanceKm(a.lat, a.lng, b.lat, b.lng) <= 0.05,
      ),
    );
    if (near.length < 3) continue;
    const bhks = [...new Set(near.map((x) => x.bhk))];
    out.push({
      key,
      count: near.length,
      medianRent: med,
      bhkMix: bhks.slice(0, 3).join(", "),
    });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 8);
}
