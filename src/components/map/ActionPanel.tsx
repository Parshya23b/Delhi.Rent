"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInr } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import {
  annualSavings,
  computeActionInsights,
  NEARBY_LIMIT,
} from "@/lib/action-insights";
import type { RentEntry } from "@/types/rent";

function distanceLabel(km: number, t: (k: string) => string): string {
  if (km < 1) return `${Math.round(km * 1000)}${t("metersShort")}`;
  return `${km.toFixed(1)}${t("kmShort")}`;
}

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : "",
  );
}

export function ActionPanel({
  entry,
  allEntries,
  onSelectEntry,
  onSeeCheaperNearby,
}: {
  entry: RentEntry;
  allEntries: RentEntry[];
  onSelectEntry: (e: RentEntry) => void;
  onSeeCheaperNearby: (input: {
    bhk: string;
    rentMax: number;
    lat: number;
    lng: number;
  }) => void;
}) {
  const { t } = useLocale();
  const insights = useMemo(
    () => computeActionInsights(entry, allEntries),
    [entry, allEntries],
  );

  const {
    nearbyListings,
    medianNearby,
    sampleSize,
    overpricedBy,
    overpricedPct,
    ownerAlternatives,
    hasBroker,
  } = insights;

  const hasAnyAction =
    overpricedBy > 0 ||
    hasBroker ||
    nearbyListings.length > 0 ||
    medianNearby != null;

  if (!hasAnyAction) return null;

  const annual = annualSavings(overpricedBy);

  return (
    <section className="space-y-3 border-t border-white/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {t("actionPanelTitle")}
      </p>

      {overpricedBy > 0 && medianNearby ? (
        <div className="rounded-xl bg-emerald-500/15 p-3 ring-1 ring-emerald-400/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-100">
                {interpolate(t("savingsHeadline"), {
                  amount: formatInr(overpricedBy),
                })}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-100/80">
                {interpolate(t("savingsBody"), {
                  median: formatInr(medianNearby),
                  bhk: entry.bhk,
                  sample: sampleSize,
                  pct: Math.round(overpricedPct * 100),
                })}
              </p>
              {annual > 0 ? (
                <p className="mt-0.5 text-[11px] font-medium text-emerald-200">
                  {interpolate(t("savingsAnnual"), {
                    amount: formatInr(annual),
                  })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() =>
                onSeeCheaperNearby({
                  bhk: entry.bhk,
                  rentMax: Math.round(medianNearby * 1.05),
                  lat: entry.lat,
                  lng: entry.lng,
                })
              }
              className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-900/30 transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              {t("seeCheaperNearby")}
            </button>
          </div>
        </div>
      ) : null}

      {hasBroker ? (
        <div className="rounded-xl bg-sky-500/10 p-3 ring-1 ring-sky-400/30">
          <p className="text-sm font-semibold text-sky-100">
            {t("brokerBypassHeadline")}
          </p>
          <p className="mt-0.5 text-[11px] text-sky-100/80">
            {t("brokerBypassBody")}
          </p>

          {ownerAlternatives.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {ownerAlternatives.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(e)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-left text-xs text-zinc-100 transition hover:bg-white/10"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="rounded bg-emerald-400/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
                        {t("ownerTag")}
                      </span>
                      <span className="truncate">
                        {formatInr(e.rent_inr)} · {e.bhk}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-400">
                      {distanceLabel(
                        distanceKm(entry.lat, entry.lng, e.lat, e.lng),
                        t,
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <details className="mt-2 text-[11px] text-sky-100/80 [&_summary]:cursor-pointer [&_summary]:select-none">
            <summary className="font-medium text-sky-200 hover:underline">
              {t("brokerBypassTipsToggle")}
            </summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>{t("brokerTip1")}</li>
              <li>{t("brokerTip2")}</li>
              <li>{t("brokerTip3")}</li>
            </ul>
          </details>
        </div>
      ) : null}

      {nearbyListings.length > 0 ? (
        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-100">
              {interpolate(t("nearbyListingsTitle"), { bhk: entry.bhk })}
            </p>
            <span className="text-[11px] text-zinc-500">
              {interpolate(t("nearbyListingsCount"), {
                shown: nearbyListings.length,
                limit: NEARBY_LIMIT,
              })}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {nearbyListings.map((e) => {
              const km = distanceKm(entry.lat, entry.lng, e.lat, e.lng);
              const isCheaper = e.rent_inr < entry.rent_inr;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(e)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-left text-xs text-zinc-100 transition hover:bg-white/10"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={clsx(
                          "tabular-nums font-semibold",
                          isCheaper ? "text-emerald-200" : "text-zinc-100",
                        )}
                      >
                        {formatInr(e.rent_inr)}
                      </span>
                      {e.broker_or_owner?.toLowerCase() === "owner" ? (
                        <span className="rounded bg-emerald-400/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
                          {t("ownerTag")}
                        </span>
                      ) : null}
                      <span className="truncate text-zinc-400">
                        {e.area_label ?? ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {distanceLabel(km, t)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
