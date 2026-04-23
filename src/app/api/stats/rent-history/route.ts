import { monthPointsFromHistoryRows } from "@/lib/rent-trends";
import { getSupabaseRead } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseBbox(searchParams: URLSearchParams) {
  const minLat = Number(searchParams.get("minLat"));
  const maxLat = Number(searchParams.get("maxLat"));
  const minLng = Number(searchParams.get("minLng"));
  const maxLng = Number(searchParams.get("maxLng"));
  if (
    [minLat, maxLat, minLng, maxLng].some((n) => Number.isNaN(n)) ||
    minLat >= maxLat ||
    minLng >= maxLng
  ) {
    return null;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bbox = parseBbox(searchParams);
  if (!bbox) {
    return NextResponse.json({ error: "Invalid or missing bbox" }, { status: 400 });
  }

  const months = Math.min(36, Math.max(3, Number(searchParams.get("months")) || 24));
  const sinceIso = new Date(Date.now() - months * 31 * 24 * 60 * 60 * 1000).toISOString();
  const bhk = searchParams.get("bhk")?.trim() || null;

  const supabase = getSupabaseRead();
  if (!supabase) {
    return NextResponse.json({ series: [] });
  }

  const { data, error } = await supabase.rpc("rent_history_monthly_medians", {
    min_lng: bbox.minLng,
    min_lat: bbox.minLat,
    max_lng: bbox.maxLng,
    max_lat: bbox.maxLat,
    since_iso: sinceIso,
    bhk_filter: bhk && bhk !== "all" ? bhk : null,
  });

  if (error) {
    console.warn("[rent-history]", error.message);
    return NextResponse.json({ series: [] });
  }

  const rows = (data ?? []) as {
    month_key: string;
    median_rent: number;
    pin_count: number;
  }[];

  return NextResponse.json({
    series: monthPointsFromHistoryRows(rows, months),
  });
}
