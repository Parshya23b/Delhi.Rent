/**
 * Reverse geocode for client code — calls `/api/geocode` so secret tokens stay on the server.
 */
export async function reverseGeocodeShort(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
    if (!res.ok) return "Delhi NCR";
    const data = (await res.json()) as { label?: string };
    return typeof data.label === "string" ? data.label : "Delhi NCR";
  } catch {
    return "Delhi NCR";
  }
}
