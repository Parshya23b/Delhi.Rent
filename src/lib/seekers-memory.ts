/**
 * In-memory fallback store for seeker pins when Supabase is unavailable,
 * or for local-only testing. Resets when the Next.js server restarts.
 */

import type { SeekerDraft, SeekerPin } from "@/types/seeker";

type StoredSeeker = SeekerPin & {
  device_id_hash: string | null;
  ip_hash: string | null;
};

const seekers = new Map<string, StoredSeeker>();

const deviceRecent = new Map<string, number>();
const SEEKER_COOLDOWN_MS = 4 * 60 * 60 * 1000;

export function checkSeekerCooldown(deviceHash: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const last = deviceRecent.get(deviceHash);
  if (!last) return { ok: true };
  const elapsed = Date.now() - last;
  if (elapsed >= SEEKER_COOLDOWN_MS) return { ok: true };
  return {
    ok: false,
    retryAfterSec: Math.ceil((SEEKER_COOLDOWN_MS - elapsed) / 1000),
  };
}

export function recordSeekerSubmission(deviceHash: string): void {
  deviceRecent.set(deviceHash, Date.now());
}

export function addSeekerMemory(
  draft: SeekerDraft,
  deviceHash: string | null,
  ipHash: string | null,
): SeekerPin {
  const id = `local-seek-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const record: StoredSeeker = {
    id,
    lat: draft.lat,
    lng: draft.lng,
    area_label: draft.area_label,
    looking_for: draft.looking_for,
    budget_inr: draft.budget_inr,
    bhk_pref: draft.bhk_pref,
    move_in_timeline: draft.move_in_timeline,
    food_pref: draft.food_pref,
    smoke_pref: draft.smoke_pref,
    self_gender: draft.self_gender,
    pref_flatmate_gender: draft.pref_flatmate_gender,
    lifestyle_note: draft.lifestyle_note,
    email: draft.email,
    phone: draft.phone,
    created_at: now,
    status: "active",
    device_id_hash: deviceHash,
    ip_hash: ipHash,
  };
  seekers.set(id, record);
  return stripPrivate(record);
}

export function listSeekersMemory(bbox?: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): SeekerPin[] {
  const all = Array.from(seekers.values()).filter((s) => s.status === "active");
  const filtered = bbox
    ? all.filter(
        (s) =>
          s.lat >= bbox.minLat &&
          s.lat <= bbox.maxLat &&
          s.lng >= bbox.minLng &&
          s.lng <= bbox.maxLng,
      )
    : all;
  return filtered
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 200)
    .map(stripPrivate);
}

function stripPrivate(record: StoredSeeker): SeekerPin {
  const { email: _e, phone: _p, device_id_hash: _d, ip_hash: _i, ...rest } = record;
  void _e; void _p; void _d; void _i;
  return rest;
}
