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

interface RentState {
  entries: RentEntry[];
  setEntries: (e: RentEntry[]) => void;
  mergeEntries: (e: RentEntry[]) => void;
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

export const useRentStore = create<RentState>()(
  persist(
    (set, get) => ({
      entries: [],
      setEntries: (entries) => set({ entries }),
      mergeEntries: (more) => {
        const cur = get().entries;
        const ids = new Set(cur.map((x) => x.id));
        const merged = [...cur];
        for (const e of more) {
          if (!ids.has(e.id)) {
            ids.add(e.id);
            merged.push(e);
          }
        }
        set({ entries: merged });
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
      layers: { metro: true, zones: true, rera: false, safety: false },
      setLayers: (p) => set({ layers: { ...get().layers, ...p } }),
      mapFilters: defaultMapFilters,
      setMapFilters: (p) =>
        set({ mapFilters: { ...get().mapFilters, ...p } }),
    }),
    {
      name: "delhi-rent-store",
      partialize: (s) => ({
        hasContributed: s.hasContributed,
        layers: s.layers,
        mapFilters: s.mapFilters,
      }),
    },
  ),
);
