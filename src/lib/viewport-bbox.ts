/** Approximate viewport bounds from center + zoom (WGS84) for bbox API queries. */
export function bboxFromCenterZoom(
  lat: number,
  lng: number,
  zoom: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const pad = Math.max(0.06, Math.min(3.2, 14 / Math.pow(2, zoom - 6.5)));
  return {
    minLat: lat - pad,
    maxLat: lat + pad,
    minLng: lng - pad,
    maxLng: lng + pad,
  };
}
