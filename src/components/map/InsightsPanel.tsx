"use client";

import { ShareInsightCard } from "@/components/map/ShareInsightCard";
import { LeaderboardMini } from "@/components/map/LeaderboardMini";
import { TrendsMini } from "@/components/map/TrendsMini";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MapFilterState } from "@/lib/filter-entries";
import { formatInr, formatInrShort } from "@/lib/format";
import { computeAreaStats } from "@/lib/rent-engine";
import type { BuildingCluster } from "@/lib/building-clusters";
import type { LocalityCount } from "@/lib/locality-leaderboard";
import type { MonthPoint } from "@/lib/rent-trends";
import { useRentStore } from "@/store/useRentStore";
import type { RentEntry } from "@/types/rent";
import clsx from "clsx";
import { useMemo, useState } from "react";

export type LiveSnapshot = {
  pinsLoaded: number;
  pinsOnMapFiltered: number;
  pinsNearCenter: number;
  totalRentInrFiltered: number;
  mapFilters: MapFilterState;
  showHeatmap: boolean;
  layers: { metro: boolean; zones: boolean; rera: boolean; safety: boolean };
};

function onOff(t: (k: string) => string, on: boolean) {
  return on ? t("liveStatsOn") : t("liveStatsOff");
}

function rentRangeLabel(f: MapFilterState, t: (k: string) => string): string {
  if (f.rentMin != null && f.rentMax != null) {
    return `${formatInrShort(f.rentMin)} – ${formatInrShort(f.rentMax)}`;
  }
  if (f.rentMin != null) return `≥ ${formatInrShort(f.rentMin)}`;
  if (f.rentMax != null) return `≤ ${formatInrShort(f.rentMax)}`;
  return t("liveStatsFilterAll");
}

function LiveSnapshotGrid({ data }: { data: LiveSnapshot }) {
  const { t } = useLocale();
  const { mapFilters: f, layers: L } = data;
  return (
    <div className="mb-4 rounded-xl border border-teal-500/25 bg-teal-950/25 p-3 dark:bg-teal-950/20">
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-300/90">
        {t("liveStatsSnapshotTitle")}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{t("liveStatsSnapshotBody")}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
          <dt className="text-[10px] text-zinc-500">{t("liveStatsPinsLoaded")}</dt>
          <dd className="font-semibold tabular-nums text-white">{data.pinsLoaded}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
          <dt className="text-[10px] text-zinc-500">{t("liveStatsPinsMap")}</dt>
          <dd className="font-semibold tabular-nums text-white">{data.pinsOnMapFiltered}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
          <dt className="text-[10px] text-zinc-500">{t("liveStatsNearCenter")}</dt>
          <dd className="font-semibold tabular-nums text-white">{data.pinsNearCenter}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
          <dt className="text-[10px] text-zinc-500">{t("liveStatsRentSum")}</dt>
          <dd className="font-semibold tabular-nums text-white">
            {formatInrShort(data.totalRentInrFiltered)}
          </dd>
        </div>
      </dl>
      <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {t("liveStatsFilters")}
      </p>
      <ul className="space-y-1 text-[11px] text-zinc-300">
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">{t("liveStatsBhk")}</span>
          <span className="text-right font-medium text-white">
            {f.bhk === "all" ? t("liveStatsFilterAll") : f.bhk}
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">{t("liveStatsFurnishing")}</span>
          <span className="text-right font-medium text-white">
            {f.furnishing === "all" ? t("liveStatsFilterAll") : f.furnishing}
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">{t("liveStatsRentRange")}</span>
          <span className="text-right font-medium text-white">{rentRangeLabel(f, t)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">{t("liveStatsLast12")}</span>
          <span className="text-right font-medium text-white">{onOff(t, f.last12MonthsOnly)}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">{t("liveStatsWomenOnly")}</span>
          <span className="text-right font-medium text-white">{onOff(t, f.womenOnly)}</span>
        </li>
      </ul>
      <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {t("liveStatsLayers")}
      </p>
      <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-zinc-300">
        <li className="flex justify-between gap-1 rounded-md bg-white/5 px-2 py-1">
          <span>{t("liveStatsHeatmap")}</span>
          <span className="font-medium text-white">{onOff(t, data.showHeatmap)}</span>
        </li>
        <li className="flex justify-between gap-1 rounded-md bg-white/5 px-2 py-1">
          <span>{t("liveStatsMetro")}</span>
          <span className="font-medium text-white">{onOff(t, L.metro)}</span>
        </li>
        <li className="flex justify-between gap-1 rounded-md bg-white/5 px-2 py-1">
          <span>{t("liveStatsZones")}</span>
          <span className="font-medium text-white">{onOff(t, L.zones)}</span>
        </li>
        <li className="flex justify-between gap-1 rounded-md bg-white/5 px-2 py-1">
          <span>{t("liveStatsRera")}</span>
          <span className="font-medium text-white">{onOff(t, L.rera)}</span>
        </li>
        <li className="col-span-2 flex justify-between gap-1 rounded-md bg-white/5 px-2 py-1">
          <span>{t("liveStatsSafety")}</span>
          <span className="font-medium text-white">{onOff(t, L.safety)}</span>
        </li>
      </ul>
    </div>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className={clsx("text-teal-600 transition dark:text-teal-400", up && "rotate-180")}
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InsightsPanel({
  areaLabel,
  slice,
  liveSnapshot,
  share,
  trendsPoints,
  leaderboardRows,
  buildingClusters,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
}: {
  areaLabel: string;
  slice: RentEntry[];
  /** Full “live” counts + filters shown when panel is expanded (e.g. after Live stats). */
  liveSnapshot?: LiveSnapshot;
  share: {
    bhk: string;
    area: string;
    avg: number;
    min: number;
    max: number;
  } | null;
  trendsPoints: MonthPoint[];
  leaderboardRows: LocalityCount[];
  buildingClusters: BuildingCluster[];
  /** Controlled expanded state (e.g. deep link `?insights=1`). */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const hasContributed = useRentStore((s) => s.hasContributed);
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const controlled = expandedProp !== undefined;
  const expanded = controlled ? expandedProp : uncontrolledExpanded;
  const setExpanded = (open: boolean) => {
    if (!controlled) setUncontrolledExpanded(open);
    onExpandedChange?.(open);
  };

  const stats = useMemo(() => {
    if (slice.length === 0) return null;
    return computeAreaStats(slice, areaLabel);
  }, [slice, areaLabel]);

  const shell =
    "pointer-events-auto w-full max-w-md overflow-hidden border border-white/15 bg-slate-900/75 text-left shadow-2xl backdrop-blur-xl dark:bg-[#0c1222]/82";

  const collapsedSummary = stats
    ? `${t("medianShort")} ${formatInrShort(stats.median)} · ${stats.count} ${t("entriesShort")}`
    : t("insightsPanHint");

  return (
    <div
      id="map-insights-dock"
      className={clsx(
        shell,
        expanded
          ? "max-h-[min(62vh,520px)] overflow-y-auto rounded-2xl sm:max-h-[min(68vh,600px)]"
          : "rounded-2xl",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 border-b border-white/10 px-4 py-3 text-left transition hover:bg-white/5 sm:items-center"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-400/95">
            {t("areaInsights")}
          </p>
          <p className="truncate text-sm font-semibold text-white">{areaLabel}</p>
          {!expanded ? (
            <p className="mt-0.5 truncate text-xs text-zinc-400">{collapsedSummary}</p>
          ) : null}
        </div>
        <span className="shrink-0 pt-0.5 text-zinc-400" title={expanded ? t("collapseDetails") : t("expandDetails")}>
          <Chevron up={!expanded} />
        </span>
      </button>

      {expanded ? (
        <div className="max-h-[min(54vh,480px)] overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:max-h-[min(60vh,520px)]">
          {liveSnapshot ? <LiveSnapshotGrid data={liveSnapshot} /> : null}
          <div className="relative mt-0">
            <div
              className={`space-y-2 ${!hasContributed ? "select-none blur-sm" : ""}`}
            >
              {stats ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] text-zinc-400">Average</p>
                      <p className="font-semibold text-white">{formatInrShort(stats.average)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] text-zinc-400">Median</p>
                      <p className="font-semibold text-white">{formatInrShort(stats.median)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] text-zinc-400">Range</p>
                      <p className="font-semibold text-white">
                        {formatInrShort(stats.min)} – {formatInrShort(stats.max)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] text-zinc-400">Entries</p>
                      <p className="font-semibold text-white">{stats.count}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-teal-500/30 bg-teal-600/15 px-3 py-2 text-sm text-teal-50">
                    <span className="font-semibold">Most people here pay ~ </span>
                    {formatInr(stats.most_common_bucket_inr)}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400">{t("insightsEmpty")}</p>
              )}
            </div>

            {!hasContributed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-950/60 p-3 text-center">
                <p className="text-xs font-semibold text-white">
                  Add one anonymous rent to unlock exact averages & heatmap
                </p>
                <p className="text-[11px] text-zinc-300">
                  Tap the map → share your rent → instant unlock for this device.
                </p>
              </div>
            ) : null}
          </div>

          <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
            {t("methodologyBlurb")}
          </p>

          {hasContributed && stats ? (
            <>
              <TrendsMini points={trendsPoints} />
              <LeaderboardMini rows={leaderboardRows} maxRows={50} />
              {buildingClusters.length > 0 ? (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("buildingGroups")}
                  </p>
                  <ul className="mt-1 max-h-[min(36vh,240px)] space-y-1 overflow-y-auto overscroll-contain pr-1 text-xs text-zinc-300">
                    {buildingClusters.map((b) => (
                      <li key={b.key}>
                        ~{b.count} pins · median {formatInrShort(b.medianRent)} · {b.bhkMix}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {hasContributed && share ? (
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Shareable insight
              </p>
              <ShareInsightCard
                bhk={share.bhk}
                area={share.area}
                avg={share.avg}
                min={share.min}
                max={share.max}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
