import { median } from "@/lib/geo";
import type { RentEntry } from "@/types/rent";

export type MonthPoint = { key: string; label: string; median: number; count: number };

/** Median rent by calendar month using created_at (submission time). */
export function medianRentByMonth(entries: RentEntry[], maxMonths = 12): MonthPoint[] {
  const byMonth = new Map<string, number[]>();
  for (const e of entries) {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
