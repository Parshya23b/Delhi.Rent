"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { WatchlistItem } from "@/lib/watchlist-storage";
import { MapLayerList } from "@/components/map/MapLayerList";
import { WatchlistBar } from "@/components/map/WatchlistBar";
import clsx from "clsx";
import { useEffect } from "react";

export function MapSidePanel({
  open,
  onClose,
  watchlist,
  onUseWatchlist,
  onSaveCenter,
  onCompare,
  onCopyLink,
  onCyberIsochrone,
  isochroneActive,
  canSaveCenter,
}: {
  open: boolean;
  onClose: () => void;
  watchlist: WatchlistItem[];
  onUseWatchlist: (w: WatchlistItem) => void;
  onSaveCenter: () => void;
  onCompare: () => void;
  onCopyLink: () => void;
  onCyberIsochrone?: () => void;
  isochroneActive?: boolean;
  canSaveCenter: boolean;
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        role="presentation"
        className={clsx(
          "fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/60",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        id="map-side-panel"
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100vw-2.5rem,20rem)] max-w-full flex-col border-r border-white/10 bg-slate-900/88 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out dark:bg-[#0c1222]/92",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={!open}
        aria-label={t("mapAndSaved")}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-400/95">
              {t("brand")}
            </p>
            <h2 className="text-sm font-semibold text-white">{t("mapAndSaved")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
            aria-label={t("closePanel")}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-teal-400/90">
              {t("mapAndLayers")}
            </h3>
            <MapLayerList
              variant="glass"
              onCyberIsochrone={onCyberIsochrone}
              isochroneActive={isochroneActive}
            />
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-teal-400/90">
              {t("watchlist")}
            </h3>
            <WatchlistBar
              tone="dark"
              className="w-full max-w-none"
              items={watchlist}
              onUse={(w) => {
                onUseWatchlist(w);
                onClose();
              }}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-teal-400/90">
              {t("quickActions")}
            </h3>
            <button
              type="button"
              disabled={!canSaveCenter}
              onClick={onSaveCenter}
              className="w-full rounded-xl border border-teal-500/40 bg-teal-600/25 px-3 py-2.5 text-center text-xs font-semibold text-teal-50 shadow-sm transition hover:bg-teal-600/35 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("watchlist")} +
            </button>
            <button
              type="button"
              onClick={() => {
                onCompare();
                onClose();
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-xs font-medium text-zinc-100 transition hover:bg-white/10"
            >
              {t("compareAreas")}
            </button>
            <button
              type="button"
              onClick={onCopyLink}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-xs font-medium text-zinc-100 transition hover:bg-white/10"
            >
              {t("copyMapLink")}
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
