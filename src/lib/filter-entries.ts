import type { RentEntry } from "@/types/rent";

export type MapFilterState = {
  bhk: "all" | string;
  furnishing: "all" | string;
  rentMin: number | null;
  rentMax: number | null;
  last12MonthsOnly: boolean;
  /** Show only pins marked women-only / female-hosted */
  womenOnly: boolean;
};

/** Show every listing on the map (used as store default and after a successful pin submit). */
export const DEFAULT_MAP_FILTERS: MapFilterState = {
  bhk: "all",
  furnishing: "all",
  rentMin: null,
  rentMax: null,
  last12MonthsOnly: false,
  womenOnly: false,
};

const MS_12M = 365 * 24 * 60 * 60 * 1000;

function withinLast12Months(e: RentEntry): boolean {
  const t = new Date(e.created_at).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= MS_12M;
}

/** Prefer move_in_month when present for “fresh lease” filter */
function moveInWithinLast12Months(e: RentEntry): boolean {
  if (!e.move_in_month) return withinLast12Months(e);
  const [y, m] = e.move_in_month.split("-").map(Number);
  if (!y || !m) return withinLast12Months(e);
  const d = new Date(y, m - 1, 1);
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  return d >= yearAgo;
}

export function filterRentEntries(
  entries: RentEntry[],
  f: MapFilterState,
): RentEntry[] {
  return entries.filter((e) => {
    if (f.bhk !== "all" && e.bhk !== f.bhk) return false;
    if (f.furnishing !== "all") {
      if (!e.furnishing || e.furnishing !== f.furnishing) return false;
    }
    if (f.rentMin != null && e.rent_inr < f.rentMin) return false;
    if (f.rentMax != null && e.rent_inr > f.rentMax) return false;
    if (f.last12MonthsOnly && !moveInWithinLast12Months(e)) return false;
    if (f.womenOnly && !e.women_only) return false;
    return true;
  });
}
