import { getMapboxToken } from "@/lib/mapbox-token";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Mapbox Isochrone — driving or walking contours */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lng = Number(searchParams.get("lng"));
  const lat = Number(searchParams.get("lat"));
  const minutes = Math.min(60, Math.max(5, Number(searchParams.get("minutes")) || 30));
  const profile = searchParams.get("profile") === "walking" ? "walking" : "driving";
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const token = getMapboxToken();
  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 503 });
  }
  try {
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      console.error("Isochrone error", res.status, t);
      return NextResponse.json({ error: "Isochrone request failed" }, { status: 502 });
    }
    const geojson = await res.json();
    return NextResponse.json(geojson);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Isochrone failed" }, { status: 500 });
  }
}
