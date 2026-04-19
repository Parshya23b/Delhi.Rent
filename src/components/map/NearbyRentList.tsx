"use client";

import { formatInrShort } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import type { RentEntry } from "@/types/rent";
import { useMemo } from "react";

export function NearbyRentList({
  centerLat,
  centerLng,
  entries,
  title,
}: {
  centerLat: number;
  centerLng: number;
  entries: RentEntry[];
  title: string;
}) {
  const sorted = useMemo(() => {
    return [...entries]
      .map((e) => ({
        e,
        d: distanceKm(centerLat, centerLng, e.lat, e.lng),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 40);
  }, [entries, centerLat, centerLng]);

  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Showing nearest listings (map could not load — check connection or token).
      </p>
      <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {sorted.map(({ e, d }) => (
          <li key={e.id} className="flex justify-between gap-2 py-2">
            <span className="text-zinc-800 dark:text-zinc-100">
              {formatInrShort(e.rent_inr)} · {e.bhk}
              {e.area_label ? (
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{e.area_label}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{d.toFixed(1)} km</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
