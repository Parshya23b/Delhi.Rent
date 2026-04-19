"use client";

import { ShareInsightCard } from "@/components/map/ShareInsightCard";
import { LeaderboardMini } from "@/components/map/LeaderboardMini";
import { TrendsMini } from "@/components/map/TrendsMini";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInr, formatInrShort } from "@/lib/format";
import { computeAreaStats } from "@/lib/rent-engine";
import type { BuildingCluster } from "@/lib/building-clusters";
import type { LocalityCount } from "@/lib/locality-leaderboard";
import type { MonthPoint } from "@/lib/rent-trends";
import { useRentStore } from "@/store/useRentStore";
import type { RentEntry } from "@/types/rent";
import clsx from "clsx";
import { useMemo, useState } from "react";

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
          ? "max-h-[min(56vh,480px)] overflow-y-auto rounded-2xl sm:max-h-[min(60vh,520px)]"
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
        <div className="max-h-[min(48vh,420px)] overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:max-h-[min(52vh,460px)]">
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
              <LeaderboardMini rows={leaderboardRows} />
              {buildingClusters.length > 0 ? (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("buildingGroups")}
                  </p>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                    {buildingClusters.slice(0, 4).map((b) => (
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
