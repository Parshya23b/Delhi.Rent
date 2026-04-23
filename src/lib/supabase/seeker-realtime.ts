"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type MatchInsertPayload = {
  new: Record<string, unknown>;
};

export type ContactRequestPayload = {
  new: Record<string, unknown>;
  old?: Record<string, unknown>;
};

/**
 * Step 7 — Pin owner: new property matches for a seeker pin (Realtime INSERT).
 */
export function subscribeMatchesForSeekerPin(
  supabase: SupabaseClient,
  seekerPinId: string,
  onInsert: (payload: MatchInsertPayload) => void,
): RealtimeChannel {
  return supabase
    .channel(`matches:pin:${seekerPinId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "matches",
        filter: `seeker_id=eq.${seekerPinId}`,
      },
      (payload) => onInsert(payload as MatchInsertPayload),
    )
    .subscribe();
}

/**
 * Step 7 — Pin owner: incoming contact requests + status changes (approve → unlock in UI).
 */
export function subscribeContactRequestsForSeekerPin(
  supabase: SupabaseClient,
  seekerPinId: string,
  handlers: {
    onInsert?: (payload: ContactRequestPayload) => void;
    onUpdate?: (payload: ContactRequestPayload) => void;
  },
): RealtimeChannel {
  const ch = supabase
    .channel(`contact_requests:pin:${seekerPinId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "contact_requests",
        filter: `seeker_id=eq.${seekerPinId}`,
      },
      (payload) => handlers.onInsert?.(payload as ContactRequestPayload),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "contact_requests",
        filter: `seeker_id=eq.${seekerPinId}`,
      },
      (payload) => handlers.onUpdate?.(payload as ContactRequestPayload),
    );

  return ch.subscribe();
}

/**
 * Step 7 — Responder: updates to requests they sent (e.g. approved → unlock contact in UI).
 */
export function subscribeContactRequestsForResponder(
  supabase: SupabaseClient,
  responderUserId: string,
  onUpdate: (payload: ContactRequestPayload) => void,
): RealtimeChannel {
  return supabase
    .channel(`contact_requests:responder:${responderUserId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "contact_requests",
        filter: `responder_id=eq.${responderUserId}`,
      },
      (payload) => onUpdate(payload as ContactRequestPayload),
    )
    .subscribe();
}

export function removeChannel(supabase: SupabaseClient, channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}
