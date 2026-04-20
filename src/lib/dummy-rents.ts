import type { RentEntry, VerificationStatus } from "@/types/rent";

/** Delhi NCR center-ish */
const SEED_POINTS: Array<{
  lat: number;
  lng: number;
  area: string;
  base2bhk: number;
  spread: number;
}> = [
  { lat: 28.6139, lng: 77.209, area: "Connaught Place", base2bhk: 55000, spread: 12000 },
  { lat: 28.5272, lng: 77.2166, area: "Saket", base2bhk: 42000, spread: 9000 },
  { lat: 28.5494, lng: 77.2001, area: "Hauz Khas", base2bhk: 45000, spread: 10000 },
  { lat: 28.4672, lng: 77.081, area: "Dwarka", base2bhk: 22000, spread: 5000 },
  { lat: 28.4595, lng: 77.0266, area: "Dwarka Sector 21", base2bhk: 24000, spread: 5500 },
  { lat: 28.5355, lng: 77.391, area: "Noida Sector 62", base2bhk: 26000, spread: 6000 },
  { lat: 28.5706, lng: 77.3213, area: "Noida Sector 18", base2bhk: 30000, spread: 7000 },
  { lat: 28.4512, lng: 77.0865, area: "Golf Course Road", base2bhk: 65000, spread: 15000 },
  { lat: 28.4089, lng: 77.0378, area: "Gurgaon Cyber City", base2bhk: 58000, spread: 14000 },
  { lat: 28.4724, lng: 77.051, area: "Gurgaon DLF Phase 3", base2bhk: 52000, spread: 12000 },
  { lat: 28.6517, lng: 77.2219, area: "Rohini", base2bhk: 18000, spread: 4000 },
  { lat: 28.7041, lng: 77.1025, area: "Pitampura", base2bhk: 22000, spread: 5000 },
  { lat: 28.6329, lng: 77.2196, area: "Model Town", base2bhk: 28000, spread: 6000 },
  { lat: 28.6129, lng: 77.2295, area: "Lajpat Nagar", base2bhk: 35000, spread: 8000 },
  { lat: 28.5677, lng: 77.2433, area: "Greater Kailash", base2bhk: 48000, spread: 11000 },
  { lat: 28.5245, lng: 77.1855, area: "Vasant Kunj", base2bhk: 40000, spread: 9000 },
  { lat: 28.7448, lng: 77.118, area: "Netaji Subhash Place", base2bhk: 26000, spread: 6000 },
  { lat: 28.6518, lng: 77.2749, area: "Preet Vihar", base2bhk: 24000, spread: 5500 },
];

const BHK_MULT: Record<string, number> = {
  "1RK": 0.45,
  "1BHK": 0.65,
  "2BHK": 1,
  "3BHK": 1.35,
  "4BHK+": 1.7,
};

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic dummy crowd data for demo / offline map */
export function generateDummyRents(): RentEntry[] {
  const out: RentEntry[] = [];
  let n = 0;
  for (const hub of SEED_POINTS) {
    for (let i = 0; i < 12; i++) {
      for (const bhk of Object.keys(BHK_MULT)) {
        const id = `dummy-${n++}`;
        const h = hash(id);
        const jitterLat = ((h % 1000) / 1e5 - 0.005) * 1.2;
        const jitterLng = (((h >> 8) % 1000) / 1e5 - 0.005) * 1.2;
        const noise = ((h % 2000) / 2000 - 0.5) * hub.spread;
        const rent = Math.round(
          (hub.base2bhk * BHK_MULT[bhk]! + noise) / 500,
        ) * 500;
        const monthsAgo = (h % 18) + 1;
        const d = new Date();
        d.setMonth(d.getMonth() - monthsAgo);
        const dep = Math.round((rent * (2 + (h % 3))) / 500) * 500;
        const maint = h % 5 === 0 ? Math.round(rent * 0.08) : null;
        const womenOnly = (h % 100) < 28;
        const createdAt = new Date(Date.now() - (h % 86400000) * 40).toISOString();

        const verificationBucket = h % 10;
        const verification_status: VerificationStatus =
          verificationBucket < 2
            ? "verified_document"
            : verificationBucket < 7
              ? "self-reported"
              : "unverified";

        const confirmations_count =
          verification_status === "verified_document"
            ? 5 + (h % 9)
            : verification_status === "self-reported"
              ? h % 6
              : 0;

        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(createdAt).getTime()) / 86400000,
        );
        const daysBack = Math.min(daysSinceCreated, (h % 28) + 1);
        const last_updated =
          confirmations_count > 0
            ? new Date(Date.now() - daysBack * 86400000).toISOString()
            : createdAt;

        out.push({
          id,
          lat: hub.lat + jitterLat,
          lng: hub.lng + jitterLng,
          rent_inr: Math.max(8000, rent),
          bhk,
          women_only: womenOnly,
          area_label: hub.area,
          move_in_month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          broker_or_owner: h % 3 === 0 ? "Owner" : h % 3 === 1 ? "Broker" : null,
          furnishing:
            h % 4 === 0
              ? "Fully furnished"
              : h % 4 === 2
                ? "Semi-furnished"
                : "Unfurnished",
          maintenance_inr: maint,
          deposit_inr: dep,
          opt_in_building_aggregate: h % 7 === 0,
          created_at: createdAt,
          verification_status,
          confirmations_count,
          last_updated,
        });
      }
    }
  }
  return out;
}
