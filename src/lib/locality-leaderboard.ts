import type { RentEntry } from "@/types/rent";

export type LocalityCount = { locality: string; count: number };

function normLabel(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length ? t : null;
}

/** Privacy-preserving: aggregate counts by area_label only */
export function localityContributionCounts(
  entries: RentEntry[],
  limit = 15,
): LocalityCount[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    const loc = normLabel(e.area_label);
    if (!loc) continue;
    map.set(loc, (map.get(loc) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([locality, count]) => ({ locality, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
