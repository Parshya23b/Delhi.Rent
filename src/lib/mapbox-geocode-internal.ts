import "server-only";

import { getMapboxToken } from "@/lib/mapbox-token";

/**
 * Server-only Mapbox Geocoding. Uses secret token first, then public token.
 */

export type ForwardResult = {
  name: string;
  lng: number;
  lat: number;
};

export async function mapboxForwardGeocode(
  query: string,
): Promise<ForwardResult[]> {
  const token = getMapboxToken();
  if (!token || !query.trim()) return [];
  try {
    const q = encodeURIComponent(query.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=6&proximity=77.209,28.6139&country=IN&types=place,locality,neighborhood,district,address,poi`;
    const res = await fetch(url);
    const data = await res.json();
    const feats = data?.features ?? [];
    return feats
      .map((f: { place_name?: string; text?: string; center?: [number, number] }) => ({
        name: String(f.place_name ?? f.text ?? ""),
        lng: f.center?.[0] ?? 0,
        lat: f.center?.[1] ?? 0,
      }))
      .filter(
        (x: ForwardResult) =>
          x.name.length > 0 &&
          Number.isFinite(x.lat) &&
          Number.isFinite(x.lng),
      );
  } catch {
    return [];
  }
}

export async function mapboxReverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  const token = getMapboxToken();
  if (!token) return "Delhi NCR";
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const place =
      data?.features?.[0]?.place_name ||
      data?.features?.[0]?.text ||
      "Delhi NCR";
    return String(place).split(",").slice(0, 2).join(",").trim();
  } catch {
    return "Delhi NCR";
  }
}
