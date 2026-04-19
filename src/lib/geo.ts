/** Haversine distance in km */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  return medianSorted([...values].sort((a, b) => a - b));
}

/** Tukey fences for outlier detection */
export function isOutlierIqr(rent: number, rents: number[]): boolean {
  if (rents.length < 4) return false;
  const s = [...rents].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)]!;
  const q3 = s[Math.floor(s.length * 0.75)]!;
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return rent < low || rent > high;
}
