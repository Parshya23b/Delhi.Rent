export type PinType = "seeker" | "listing";

export type PinRow = {
  id: string;
  lat: number;
  lng: number;
  type: PinType;
  rent: number;
  bhk: number;
  deposit: number | null;
  available_from: string | null;
  preferences: Record<string, unknown>;
  email: string | null;
  phone: string | null;
  description: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  is_flagged: boolean;
  flag_count: number;
};

export type MapPin = Omit<PinRow, "email" | "phone">;

export type CreatePinPayload = {
  lat: number;
  lng: number;
  type: PinType;
  rent: number;
  bhk: number;
  deposit?: number | null;
  available_from?: string | null;
  preferences?: Record<string, unknown>;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  /** Match window; defaults from rent if omitted */
  min_rent?: number;
  max_rent?: number;
  /** When true, `find_matches` ignores BHK (passes null as user_bhk). */
  match_all_bhk?: boolean;
};

export type BBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};
