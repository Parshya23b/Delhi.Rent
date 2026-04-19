/** Shared token resolution for server routes (Isochrone, Geocoding). */
export function getMapboxToken(): string | undefined {
  return process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}
