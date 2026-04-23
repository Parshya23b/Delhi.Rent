import { median } from "@/lib/geo";
import type { RentEntry } from "@/types/rent";

export type MonthPoint = { key: string; label: string; median: number; count: number };

/** Row shape from `rent_history_monthly_medians` RPC. */
export type HistoryMonthRow = {
  month_key: string;
  median_rent: number;
  pin_count: number;
};

/** Map DB monthly aggregates to chart points (caps trailing months). */
export function monthPointsFromHistoryRows(
  rows: HistoryMonthRow[],
  maxMonths = 24,
): MonthPoint[] {
  const sorted = [...rows].sort((a, b) => a.month_key.localeCompare(b.month_key));
  const tail = sorted.slice(-maxMonths);
  return tail.map((r) => {
    const [y, m] = r.month_key.split("-");
    return {
      key: r.month_key,
      label: `${m}/${(y ?? "").slice(2)}`,
      median: Math.round(Number(r.median_rent)),
      count: Number(r.pin_count),
    };
  });
}

function monthKeyForEntry(e: RentEntry): string | null {
  const move = e.move_in_month?.trim();
  if (move && /^\d{4}-\d{2}$/.test(move)) return move;
  const d = new Date(e.created_at);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Median rent by month: prefers `move_in_month` (YYYY-MM) when set; else submission month from `created_at`. */
export function medianRentByMonth(entries: RentEntry[], maxMonths = 12): MonthPoint[] {
  const byMonth = new Map<string, number[]>();
  for (const e of entries) {
    const key = monthKeyForEntry(e);
    if (!key) continue;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e.rent_inr);
  }
  const keys = [...byMonth.keys()].sort();
  const tail = keys.slice(-maxMonths);
  return tail.map((key) => {
    const rents = byMonth.get(key)!;
    const med = median(rents);
    const [y, m] = key.split("-");
    return {
      key,
      label: `${m}/${y.slice(2)}`,
      median: Math.round(med),
      count: rents.length,
    };
  });
}
