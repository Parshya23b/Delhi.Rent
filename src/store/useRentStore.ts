"use client";

import type { MapFilterState } from "@/lib/filter-entries";
import type { RentEntry } from "@/types/rent";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const defaultMapFilters: MapFilterState = {
  bhk: "all",
  furnishing: "all",
  rentMin: null,
  rentMax: null,
  last12MonthsOnly: false,
  womenOnly: false,
};

const defaultLayers = {
  metro: true,
  zones: true,
  rera: false,
  safety: false,
} as const;

/** Union by id; later entries in `second` win (server/API overwrites stale client). */
function mergeEntriesByIdPreferSecond(first: RentEntry[], second: RentEntry[]): RentEntry[] {
  const map = new Map<string, RentEntry>();
  for (const e of first) map.set(e.id, e);
  for (const e of second) map.set(e.id, e);
  return Array.from(map.values());
}

type PersistedSlice = {
  hasContributed: boolean;
  layers: RentState["layers"];
  mapFilters: MapFilterState;
};

interface RentState {
  entries: RentEntry[];
  setEntries: (e: RentEntry[]) => void;
  mergeEntries: (e: RentEntry[]) => void;
  updateEntryFields: (id: string, patch: Partial<RentEntry>) => void;
  hasContributed: boolean;
  setHasContributed: (v: boolean) => void;
  lastSubmitted: RentEntry | null;
  setLastSubmitted: (e: RentEntry | null) => void;
  selectedEntry: RentEntry | null;
  setSelectedEntry: (e: RentEntry | null) => void;
  addSheetOpen: boolean;
  setAddSheetOpen: (v: boolean) => void;
  addDraft: { lat: number; lng: number; areaLabel: string } | null;
  setAddDraft: (d: { lat: number; lng: number; areaLabel: string } | null) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  layers: {
    metro: boolean;
    zones: boolean;
    rera: boolean;
    safety: boolean;
  };
  setLayers: (
    p: Partial<{ metro: boolean; zones: boolean; rera: boolean; safety: boolean }>,
  ) => void;
  mapFilters: MapFilterState;
  setMapFilters: (p: Partial<MapFilterState>) => void;
}

/** Bumped when persisted shape changes — v3 drops `entries`; v4 resets womenOnly filter after DB/view fix. */
const PERSIST_VERSION = 4;

export const useRentStore = create<RentState>()(
  persist(
    (set, get) => ({
      entries: [],
      setEntries: (entries) => set({ entries }),
      mergeEntries: (more) => {
        const cur = get().entries;
        set({ entries: mergeEntriesByIdPreferSecond(cur, more) });
      },
      updateEntryFields: (id, patch) => {
        const next = get().entries.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        );
        set({ entries: next });
      },
      hasContributed: false,
      setHasContributed: (v) => set({ hasContributed: v }),
      lastSubmitted: null,
      setLastSubmitted: (e) => set({ lastSubmitted: e }),
      selectedEntry: null,
      setSelectedEntry: (e) => set({ selectedEntry: e }),
      addSheetOpen: false,
      setAddSheetOpen: (v) => set({ addSheetOpen: v }),
      addDraft: null,
      setAddDraft: (d) => set({ addDraft: d }),
      showHeatmap: false,
      setShowHeatmap: (v) => set({ showHeatmap: v }),
      layers: { ...defaultLayers },
      setLayers: (p) => set({ layers: { ...get().layers, ...p } }),
      mapFilters: defaultMapFilters,
      setMapFilters: (p) =>
        set({ mapFilters: { ...get().mapFilters, ...p } }),
    }),
    {
      name: "delhi-rent-store",
      version: PERSIST_VERSION,
      partialize: (s): PersistedSlice => ({
        hasContributed: s.hasContributed,
        layers: s.layers,
        mapFilters: s.mapFilters,
      }),
      migrate: (persisted, fromVersion) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (fromVersion < PERSIST_VERSION) {
          const mapFilters: MapFilterState = {
            ...defaultMapFilters,
            ...(p.mapFilters as Partial<MapFilterState>),
          };
          // Before v4, rent_entries_expanded always exposed women_only=false, so womenOnly=true hid all pins.
          if (fromVersion < 4) {
            mapFilters.womenOnly = false;
          }
          return {
            hasContributed: Boolean(p.hasContributed),
            layers: {
              ...defaultLayers,
              ...(p.layers as RentState["layers"] | undefined),
            },
            mapFilters,
          };
        }
        return persisted as PersistedSlice;
      },
    },
  ),
);
