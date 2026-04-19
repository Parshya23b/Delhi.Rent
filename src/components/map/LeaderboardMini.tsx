"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { LocalityCount } from "@/lib/locality-leaderboard";

export function LeaderboardMini({ rows }: { rows: LocalityCount[] }) {
  const { t } = useLocale();
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {t("leaderboard")}
      </p>
      <ol className="mt-2 space-y-1 text-xs text-zinc-300">
        {rows.slice(0, 8).map((r, i) => (
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
