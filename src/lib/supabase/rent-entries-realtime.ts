import { getRentPins, rentPinFromExpandedRow, type RentPin } from "@/lib/supabase/get-rent-pins";
import { RENT_ENTRIES_EXPANDED } from "@/lib/rent-table";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RentEntriesRealtimeHandlers = {
  upsertPin: (pin: RentPin) => void;
  removePin: (id: string) => void;
  refetchPins: () => Promise<void>;
};

async function fetchExpandedRentPin(
  supabase: SupabaseClient,
  id: string,
): Promise<RentPin | null> {
  const { data, error } = await supabase
    .from(RENT_ENTRIES_EXPANDED)
    .select("id, lat, lng, rent_inr, bhk, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return rentPinFromExpandedRow(data as Record<string, unknown>);
}

/**
 * Subscribe to `public.rent_entries` INSERT / UPDATE / DELETE (Supabase Realtime).
 * Uses `rent_entries_expanded` for coordinates after writes.
 *
 * Ensure `rent_entries` is in the `supabase_realtime` publication.
 */
export function subscribeRentEntriesRealtime(
  supabase: SupabaseClient,
  handlers: RentEntriesRealtimeHandlers,
): () => void {
  const topic = `rent_entries_${Math.random().toString(36).slice(2, 10)}`;

  const channel = supabase
    .channel(topic)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rent_entries" },
      async (payload) => {
        const ev = payload.eventType;

        if (ev === "DELETE") {
          const oldRow = payload.old as Record<string, unknown> | null;
          const id = oldRow?.id != null ? String(oldRow.id) : "";
          console.log("[realtime rent_entries] DELETE", { id });
          if (id) handlers.removePin(id);
          return;
        }

        if (ev !== "INSERT" && ev !== "UPDATE") return;

        const raw = payload.new as Record<string, unknown> | null;
        const id = raw?.id != null ? String(raw.id) : "";
        console.log("[realtime rent_entries]", ev, { id });
        if (!id) {
          console.warn("[realtime rent_entries] missing id — full refetch");
          await handlers.refetchPins();
          return;
        }

        const pin = await fetchExpandedRentPin(supabase, id);
        if (!pin) {
          console.warn("[realtime rent_entries] expanded row missing — full refetch", { id });
          await handlers.refetchPins();
          return;
        }

        handlers.upsertPin(pin);
      },
    )
    .subscribe((status) => {
      console.log("[realtime rent_entries] channel status:", status);
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** @deprecated Prefer {@link subscribeRentEntriesRealtime} (same behaviour, clearer name). */
export const subscribeRentEntryInserts = subscribeRentEntriesRealtime;
