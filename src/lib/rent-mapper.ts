import type { RentEntry } from "@/types/rent";

export function normalizeRentRow(r: Record<string, unknown>): RentEntry {
  return {
    id: String(r.id),
    lat: Number(r.lat),
    lng: Number(r.lng),
    rent_inr: Number(r.rent_inr),
    bhk: String(r.bhk),
    area_label: r.area_label != null ? String(r.area_label) : null,
    move_in_month: r.move_in_month != null ? String(r.move_in_month) : null,
    broker_or_owner: r.broker_or_owner != null ? String(r.broker_or_owner) : null,
    furnishing: r.furnishing != null ? String(r.furnishing) : null,
    maintenance_inr:
      r.maintenance_inr != null && r.maintenance_inr !== ""
        ? Number(r.maintenance_inr)
        : null,
    deposit_inr:
      r.deposit_inr != null && r.deposit_inr !== ""
        ? Number(r.deposit_inr)
        : null,
    opt_in_building_aggregate: Boolean(r.opt_in_building_aggregate),
    women_only: Boolean(r.women_only),
    created_at: String(r.created_at),
  };
}
