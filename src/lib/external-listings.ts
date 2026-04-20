/**
 * Optional external-listings integration.
 *
 * Today this is a stub: it returns `null` so the UI transparently falls back
 * to our crowdsourced pins for the "nearby listings" card. Wire up NoBroker,
 * MagicBricks, Housing.com etc. here when their APIs / partnerships are ready.
 *
 * Contract: return at most ~10 curated direct-owner listings with a stable
 * `provider` field so the UI can badge + link each item.
 */

export type ExternalListing = {
  id: string;
  provider: "nobroker" | "magicbricks" | "housing" | "olx" | "other";
  title: string;
  rent_inr: number;
  bhk: string;
  url: string;
  area_label?: string;
  distance_km?: number;
  owner_listed?: boolean;
};

export type ExternalListingsQuery = {
  lat: number;
  lng: number;
  bhk: string;
  maxRentInr?: number;
  radiusKm?: number;
};

/**
 * Fetch nearby listings from external providers. Returns `null` when no
 * integration is configured (default). Never throws — failures fall back to
 * our own data in the UI.
 */
export async function fetchNearbyListings(
  query: ExternalListingsQuery,
): Promise<ExternalListing[] | null> {
  if (!process.env.EXTERNAL_LISTINGS_ENABLED) return null;
  try {
    // Placeholder: plug provider(s) here, e.g.
    //   const nb = await fetchNoBrokerListings(query);
    //   const mb = await fetchMagicBricksListings(query);
    //   return [...(nb ?? []), ...(mb ?? [])].slice(0, 10);
    void query;
    return null;
  } catch (err) {
    console.warn("[external-listings] provider failed:", err);
    return null;
  }
}
