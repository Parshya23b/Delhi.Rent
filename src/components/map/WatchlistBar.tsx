"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { WatchlistItem } from "@/lib/watchlist-storage";
import { saveWatchlist } from "@/lib/watchlist-storage";
import clsx from "clsx";

export function WatchlistBar({
  items,
  onUse,
  className,
  tone = "light",
}: {
  items: WatchlistItem[];
  onUse: (w: WatchlistItem) => void;
  className?: string;
  /** dark = glass side panel */
  tone?: "light" | "dark";
}) {
  const { t } = useLocale();
  const dark = tone === "dark";
  return (
    <div
      className={clsx(
        "pointer-events-auto rounded-xl p-2 text-xs",
        dark
          ? "border border-white/10 bg-white/5 shadow-none ring-0"
          : "max-w-[min(100vw-2rem,320px)] bg-white/95 shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900/95 dark:ring-zinc-700 sm:max-w-xs",
        !dark && "min-w-0",
        className,
      )}
    >
      <p
        className={clsx(
          "font-semibold",
          dark ? "text-white" : "text-zinc-800 dark:text-zinc-100",
        )}
      >
        {t("watchlist")}
      </p>
      {items.length === 0 ? (
        <p className={clsx("mt-1", dark ? "text-zinc-400" : "text-zinc-500 dark:text-zinc-400")}>
          {t("watchlistHint")}
        </p>
      ) : (
        <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto overscroll-contain">
          {items.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-1">
              <button
                type="button"
                className={clsx(
                  "truncate text-left hover:underline",
                  dark ? "text-teal-300" : "text-teal-800 dark:text-teal-400",
                )}
                onClick={() => onUse(w)}
              >
                {w.label}
              </button>
              <button
                type="button"
                className={clsx(
                  "shrink-0 hover:text-red-400",
                  dark ? "text-zinc-500" : "text-zinc-400 hover:text-red-600 dark:text-zinc-500",
                )}
                aria-label="Remove"
                onClick={() => {
                  saveWatchlist(items.filter((x) => x.id !== w.id));
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
