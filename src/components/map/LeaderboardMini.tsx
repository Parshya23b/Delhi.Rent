"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { LocalityCount } from "@/lib/locality-leaderboard";

export function LeaderboardMini({
  rows,
  maxRows = 50,
}: {
  rows: LocalityCount[];
  /** Cap for performance; set high when showing “full” live leaderboard. */
  maxRows?: number;
}) {
  const { t } = useLocale();
  if (rows.length === 0) return null;
  const shown = rows.slice(0, maxRows);
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {t("leaderboard")}
        {rows.length > maxRows ? (
          <span className="ml-1 font-normal normal-case text-zinc-600">
            ({t("liveStatsLeaderboardCap").replace("{n}", String(maxRows))})
          </span>
        ) : null}
      </p>
      <ol className="mt-2 max-h-[min(40vh,280px)] space-y-1 overflow-y-auto overscroll-contain pr-1 text-xs text-zinc-300">
        {shown.map((r, i) => (
          <li key={r.locality} className="flex justify-between gap-2">
            <span>
              {i + 1}. {r.locality}
            </span>
            <span className="text-zinc-500">{r.count} pins</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
