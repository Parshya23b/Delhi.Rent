import { localityContributionCounts } from "@/lib/locality-leaderboard";
import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import { getSupabaseRead } from "@/lib/supabase/service";
import { normalizeRentRow } from "@/lib/rent-mapper";
import type { RentEntry } from "@/types/rent";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows: RentEntry[] = [];
  const supabase = getSupabaseRead();
  if (supabase) {
    const { data, error } = await supabase.from(RENT_ENTRIES_EXPANDED).select("*");
    if (!error && data?.length) {
      const seen = new Set<string>();
      for (const r of data) {
        const e = normalizeRentRow(r as Record<string, unknown>);
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        rows.push(e);
      }
    }
  }
  const leaderboard = localityContributionCounts(rows, 20);
  return NextResponse.json({ leaderboard });
}
