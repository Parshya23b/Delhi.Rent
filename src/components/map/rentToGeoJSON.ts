import type { FeatureCollection, Point } from "geojson";
import type { RentEntry } from "@/types/rent";

export function rentsToGeoJSON(entries: RentEntry[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: entries.map((e) => ({
      type: "Feature" as const,
      properties: {
        id: e.id,
        rent_inr: e.rent_inr,
        bhk: e.bhk,
        women_only: Boolean(e.women_only),
        created_at: e.created_at,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [e.lng, e.lat],
      },
    })),
  };
}
