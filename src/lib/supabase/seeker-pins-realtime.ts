import { seekerMapPinFromRow, type SeekerMapPin } from "@/lib/supabase/get-seeker-pins";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SeekerPinsRealtimeHandlers = {
  upsertPin: (pin: SeekerMapPin) => void;
  removePin: (id: string) => void;
  refetchPins: () => Promise<void>;
};

/**
 * Subscribe to `public.seeker_pins` INSERT / UPDATE / DELETE (Supabase Realtime).
 * Add `seeker_pins` to `supabase_realtime` (see migration `023_seeker_pins_realtime.sql`).
 */
export function subscribeSeekerPinsRealtime(
  supabase: SupabaseClient,
  handlers: SeekerPinsRealtimeHandlers,
): () => void {
  const topic = `seeker_pins_${Math.random().toString(36).slice(2, 10)}`;

  const channel = supabase
    .channel(topic)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "seeker_pins" },
      async (payload) => {
        const ev = payload.eventType;

        if (ev === "DELETE") {
          const oldRow = payload.old as Record<string, unknown> | null;
          const id = oldRow?.id != null ? String(oldRow.id) : "";
          console.log("[realtime seeker_pins] DELETE", { id });
          if (id) handlers.removePin(id);
          return;
        }

        if (ev !== "INSERT" && ev !== "UPDATE") return;

        const raw = payload.new as Record<string, unknown> | null;
        if (!raw) {
          console.warn("[realtime seeker_pins] empty payload — full refetch");
          await handlers.refetchPins();
          return;
        }

        console.log("[realtime seeker_pins]", ev, {
          id: raw.id != null ? String(raw.id) : "",
          is_active: raw.is_active,
        });

        if (raw.is_active === false) {
          if (raw.id != null) handlers.removePin(String(raw.id));
          return;
        }

        const pin = seekerMapPinFromRow(raw);
        if (!pin) {
          console.warn("[realtime seeker_pins] parse failed — full refetch");
          await handlers.refetchPins();
          return;
        }

        handlers.upsertPin(pin);
      },
    )
    .subscribe((status) => {
      console.log("[realtime seeker_pins] channel status:", status);
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
