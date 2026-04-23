"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInrShort } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import type { RentEntry } from "@/types/rent";
import { useMemo } from "react";

export function ClusterFlatsSheet({
  open,
  onClose,
  entries,
  centerLat,
  centerLng,
  clusterPointCount,
  truncated,
  onPickEntry,
}: {
  open: boolean;
  onClose: () => void;
  entries: RentEntry[];
  centerLat: number;
  centerLng: number;
  clusterPointCount: number;
  truncated: boolean;
  onPickEntry: (e: RentEntry) => void;
}) {
  const { t } = useLocale();

  const sorted = useMemo(() => {
    return [...entries]
      .map((e) => ({
        e,
        d: distanceKm(centerLat, centerLng, e.lat, e.lng),
      }))
      .sort((a, b) => a.d - b.d);
  }, [entries, centerLat, centerLng]);

  const title = t("clusterFlatsTitle").replace("{count}", String(clusterPointCount));

  return (
    <BottomSheet open={open} onClose={onClose} title={title} variant="mapPlace" tall>
      <p className="text-xs text-zinc-400">{t("clusterFlatsHint")}</p>
      {truncated ? (
        <p className="mt-2 text-xs text-amber-200/90">
          {t("clusterFlatsTruncated")
            .replace("{shown}", String(entries.length))
            .replace("{total}", String(clusterPointCount))}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-white/10">
        {sorted.map(({ e, d }) => (
          <li key={e.id} className="py-2">
            <button
              type="button"
              onClick={() => onPickEntry(e)}
              className="flex w-full touch-manipulation items-start justify-between gap-3 rounded-xl px-1 py-1 text-left text-sm text-zinc-100 transition hover:bg-white/5 active:bg-white/10"
            >
              <span>
                <span className="font-semibold">
                  {formatInrShort(e.rent_inr)} · {e.bhk}
                </span>
                {e.area_label ? (
                  <span className="mt-0.5 block text-xs text-zinc-400">{e.area_label}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{d.toFixed(1)} km</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
