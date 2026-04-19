"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInrShort } from "@/lib/format";
import { computeAreaStats, entriesNearPoint } from "@/lib/rent-engine";
import type { RentEntry } from "@/types/rent";
import { useMemo } from "react";

export function CompareAreasPanel({
  open,
  onClose,
  entries,
  areaALabel,
  centerA,
  areaBLabel,
  centerB,
}: {
  open: boolean;
  onClose: () => void;
  entries: RentEntry[];
  areaALabel: string;
  centerA: { lat: number; lng: number };
  areaBLabel: string;
  centerB: { lat: number; lng: number };
}) {
  const { t } = useLocale();

  const statsA = useMemo(() => {
    const slice = entriesNearPoint(centerA.lat, centerA.lng, entries, 2.5);
    return slice.length ? computeAreaStats(slice, areaALabel) : null;
  }, [centerA, entries, areaALabel]);

  const statsB = useMemo(() => {
    const slice = entriesNearPoint(centerB.lat, centerB.lng, entries, 2.5);
    return slice.length ? computeAreaStats(slice, areaBLabel) : null;
  }, [centerB, entries, areaBLabel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 m-3 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-700">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("compareAreas")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Column label={areaALabel} stats={statsA} />
          <Column label={areaBLabel} stats={statsB} />
        </div>
      </div>
    </div>
  );
}

function Column({
  label,
  stats,
}: {
  label: string;
  stats: ReturnType<typeof computeAreaStats> | null;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100 dark:bg-zinc-800/80 dark:ring-zinc-700">
      <p className="text-xs font-medium text-teal-800 dark:text-teal-400">{label}</p>
      {stats ? (
        <ul className="mt-2 space-y-1 text-zinc-800 dark:text-zinc-100">
          <li>Median: {formatInrShort(stats.median)}</li>
          <li>
            Range: {formatInrShort(stats.min)} – {formatInrShort(stats.max)}
          </li>
          <li>n = {stats.count}</li>
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No data in radius</p>
      )}
    </div>
  );
}
