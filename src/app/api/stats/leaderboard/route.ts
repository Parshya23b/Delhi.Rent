import { generateDummyRents } from "@/lib/dummy-rents";
import { localityContributionCounts } from "@/lib/locality-leaderboard";
import { getSupabaseService } from "@/lib/supabase/service";
import { normalizeRentRow } from "@/lib/rent-mapper";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = [...generateDummyRents()];
  const supabase = getSupabaseService();
  if (supabase) {
    const { data, error } = await supabase.from("rent_entries").select("*");
    if (!error && data?.length) {
      const seen = new Set(rows.map((r) => r.id));
      for (const r of data) {
        const e = normalizeRentRow(r as Record<string, unknown>);
        if (!seen.has(e.id)) {
          seen.add(e.id);
          rows.push(e);
        }
      }
    }
  }
  const leaderboard = localityContributionCounts(rows, 20);
  return NextResponse.json({ leaderboard });
}
