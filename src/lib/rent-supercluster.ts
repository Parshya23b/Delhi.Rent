import type { FeatureCollection, Point } from "geojson";
import Supercluster from "supercluster";
import type { RentEntry } from "@/types/rent";
import { rentsToGeoJSON } from "@/components/map/rentToGeoJSON";

const CLUSTER_LEAF_PAGE = 400;
const CLUSTER_LEAF_HARD_CAP = 2000;

/** Resolve map-cluster leaf pins to rent entries (paginates getLeaves; caps for very large clusters). */
export function collectRentEntriesForCluster(
  index: Supercluster,
  clusterId: number,
  pointCount: number,
  entryById: Map<string, RentEntry>,
): { entries: RentEntry[]; truncated: boolean } {
  const cap = Math.min(pointCount, CLUSTER_LEAF_HARD_CAP);
  const out: RentEntry[] = [];
  const seen = new Set<string>();
  let offset = 0;

  while (offset < cap) {
    const pageSize = Math.min(CLUSTER_LEAF_PAGE, cap - offset);
    const leaves = index.getLeaves(clusterId, pageSize, offset);
    if (leaves.length === 0) break;
    for (const leaf of leaves) {
      const props = leaf.properties as { id?: string | number } | null | undefined;
      const id = props?.id != null ? String(props.id) : "";
      if (!id || seen.has(id)) continue;
      const e = entryById.get(id);
      if (!e) continue;
      seen.add(id);
      out.push(e);
    }
    offset += leaves.length;
    if (leaves.length < pageSize) break;
  }

  const truncated = pointCount > CLUSTER_LEAF_HARD_CAP;
  return { entries: out, truncated };
}

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
