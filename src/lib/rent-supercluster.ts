import type { FeatureCollection, Point } from "geojson";
import Supercluster from "supercluster";
import type { RentEntry } from "@/types/rent";
import { rentsToGeoJSON } from "@/components/map/rentToGeoJSON";

export function buildRentClusterIndex(entries: RentEntry[]): Supercluster {
  const fc = rentsToGeoJSON(entries) as FeatureCollection<Point>;
  const index = new Supercluster({
    radius: 72,
    maxZoom: 16,
    minZoom: 0,
    minPoints: 2,
  });
  const points = fc.features.map((f) => ({
    ...f,
    properties: f.properties ?? {},
  })) as Parameters<Supercluster["load"]>[0];
  index.load(points);
  return index;
}

export function rentShortLabel(rent_inr: number): string {
  if (rent_inr >= 10000000) return `${(rent_inr / 10000000).toFixed(1)}Cr`;
  if (rent_inr >= 100000) return `${(rent_inr / 100000).toFixed(1)}L`;
  if (rent_inr >= 1000) return `${Math.round(rent_inr / 1000)}K`;
  return String(rent_inr);
}

export function isPinNew(created_at: string): boolean {
  const t = new Date(created_at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

/** Heuristic “available” count shown on clusters (visual only). */
export function avlbFromCount(count: number): number {
  return Math.max(1, Math.min(count, Math.round(count * 0.12 + 0.4)));
}
