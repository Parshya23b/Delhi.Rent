import { generateDummyRents } from "@/lib/dummy-rents";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { isPinExpired, PIN_MAX_AGE_MS } from "@/lib/rent-policy";
import { getSupabaseService } from "@/lib/supabase/service";
import type { RentEntry } from "@/types/rent";

function sortEntriesByRecentFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Dummy + Supabase rows within retention window (same source as GET /api/rents without bbox). */
export async function loadRecentRentEntries(): Promise<RentEntry[]> {
  const dummy = generateDummyRents().filter((r) => !isPinExpired(r.created_at));
  const rows: RentEntry[] = [...dummy];

  const supabase = getSupabaseService();
  if (supabase) {
    const sinceIso = new Date(Date.now() - PIN_MAX_AGE_MS).toISOString();
    const { data, error } = await supabase
      .from("rent_entries")
      .select("*")
      .gte("created_at", sinceIso);
    if (!error && data?.length) {
      const seen = new Set(rows.map((x) => x.id));
      for (const r of data) {
        const m = normalizeRentRow(r as Record<string, unknown>);
        if (!seen.has(m.id)) {
          seen.add(m.id);
          rows.push(m);
        }
      }
    }
  }

  return sortEntriesByRecentFirst(rows);
}
