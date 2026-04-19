"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useRentStore } from "@/store/useRentStore";
import clsx from "clsx";

const btn =
  "w-full rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors";

export function MapLayerList({
  onCyberIsochrone,
  isochroneActive,
  variant = "glass",
}: {
  onCyberIsochrone?: () => void;
  isochroneActive?: boolean;
  /** glass = dark panel; light = legacy light cards */
  variant?: "glass" | "light";
}) {
  const { t } = useLocale();
  const layers = useRentStore((s) => s.layers);
  const setLayers = useRentStore((s) => s.setLayers);
  const hasContributed = useRentStore((s) => s.hasContributed);
  const showHeatmap = useRentStore((s) => s.showHeatmap);
  const setShowHeatmap = useRentStore((s) => s.setShowHeatmap);

  const glass = variant === "glass";

  const inactive = glass
    ? "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
    : "border-zinc-100 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50";

  const active = (tone: "teal" | "indigo" | "amber" | "violet" | "sky") => {
    if (glass) {
      const m = {
        teal: "border-teal-400/40 bg-teal-500/15 text-teal-100",
        indigo: "border-indigo-400/40 bg-indigo-500/15 text-indigo-100",
        amber: "border-amber-400/40 bg-amber-500/15 text-amber-100",
        violet: "border-violet-400/40 bg-violet-500/15 text-violet-100",
        sky: "border-sky-400/40 bg-sky-500/15 text-sky-100",
      };
      return m[tone];
    }
    return "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setLayers({ metro: !layers.metro })}
        className={clsx(
          btn,
          layers.metro
            ? glass
              ? active("teal")
              : "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-100"
            : inactive,
        )}
      >
        Metro lines
      </button>
      <button
        type="button"
        onClick={() => setLayers({ zones: !layers.zones })}
        className={clsx(
          btn,
          layers.zones
            ? glass
              ? active("indigo")
              : "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
            : inactive,
        )}
      >
        Key areas
      </button>
      <button
        type="button"
        onClick={() => setLayers({ rera: !layers.rera })}
        className={clsx(
          btn,
          layers.rera
            ? glass
              ? active("amber")
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
            : inactive,
        )}
      >
        {t("reraLayer")}
      </button>
      <button
        type="button"
        onClick={() => setLayers({ safety: !layers.safety })}
        className={clsx(
          btn,
          layers.safety
            ? glass
              ? active("violet")
              : "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100"
            : inactive,
        )}
      >
        {t("safetyLayer")}
      </button>
      <button
        type="button"
        disabled={!hasContributed}
        onClick={() => setShowHeatmap(!showHeatmap)}
        className={clsx(
          btn,
          !hasContributed
            ? glass
              ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-500"
              : "cursor-not-allowed border-zinc-100 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
            : showHeatmap
              ? glass
                ? active("amber")
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
              : inactive,
        )}
      >
        Heatmap {hasContributed ? "" : "(locked)"}
      </button>
      {onCyberIsochrone ? (
        <button
          type="button"
          onClick={onCyberIsochrone}
          className={clsx(
            btn,
            isochroneActive
              ? glass
                ? active("sky")
                : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
              : inactive,
          )}
        >
          {t("commuteIsochrone")}
        </button>
      ) : null}
    </div>
  );
}
