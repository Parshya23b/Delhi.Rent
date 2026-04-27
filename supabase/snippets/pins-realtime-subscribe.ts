/**
 * Frontend: subscribe to new pins and update the map immediately.
 *
 * Prereq: enable the `pins` table on `supabase_realtime` publication in the dashboard
 * (Database → Replication) or run:
 *   alter publication supabase_realtime add table public.pins;
 */

import { createClient, type RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type PinRealtimeRow = {
  id: string;
  lat: number;
  lng: number;
  type: "seeker" | "listing";
  rent: number;
  bhk: number;
  created_at: string;
};

export function subscribeToNewPins(onInsert: (row: PinRealtimeRow) => void) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const channel = supabase
    .channel("pins-inserts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "pins" },
      (payload: RealtimePostgresChangesPayload<PinRealtimeRow>) => {
        const row = payload.new as PinRealtimeRow | null;
        if (row) onInsert(row);
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("[realtime] pins channel error");
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
