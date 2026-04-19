import { formatInr } from "@/lib/format";
import { loadRecentRentEntries } from "@/lib/load-recent-rents";
import { mapboxForwardGeocode } from "@/lib/mapbox-geocode-internal";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type SearchResultItem = {
  name: string;
  lng: number;
  lat: number;
  kind: "place" | "rent_pin";
  id?: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const qLower = q.trim().toLowerCase();

  const [places, entries] = await Promise.all([
    mapboxForwardGeocode(q),
    loadRecentRentEntries(),
  ]);

  const pinMatches: SearchResultItem[] = entries
    .filter((e) => {
      const label = e.area_label?.toLowerCase() ?? "";
      const bhk = e.bhk?.toLowerCase() ?? "";
      return (
        (label.length > 0 && label.includes(qLower)) ||
        (bhk.length > 0 && bhk.includes(qLower))
      );
    })
    .slice(0, 8)
    .map((e) => ({
      kind: "rent_pin" as const,
      id: e.id,
      name: `${formatInr(e.rent_inr)} · ${e.bhk} · ${e.area_label ?? "Pin"}`,
      lng: e.lng,
      lat: e.lat,
    }));

  const placeResults: SearchResultItem[] = places.map((p) => ({
    kind: "place" as const,
    name: p.name,
    lng: p.lng,
    lat: p.lat,
  }));

  const seen = new Set<string>();
  const deduped: SearchResultItem[] = [];
  for (const item of [...pinMatches, ...placeResults]) {
    const key = `${item.lng.toFixed(5)}:${item.lat.toFixed(5)}:${item.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 12) break;
  }

  return NextResponse.json({ results: deduped });
}
