"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

function formatTotalPinned(sum: number): string {
  if (!Number.isFinite(sum) || sum <= 0) return "—";
  if (sum >= 1e7) return `₹${(sum / 1e7).toFixed(1)} Cr`;
  if (sum >= 1e5) return `₹${(sum / 1e5).toFixed(1)} L`;
  if (sum >= 1e3) return `₹${(sum / 1e3).toFixed(0)}K`;
  return `₹${Math.round(sum)}`;
}

function IconLeaf({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c4 2 7 6 7 11a7 7 0 01-14 0c0-5 3-9 7-11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 8v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14.5 14.5L20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconTrain({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 15h16M6 15V9a2 2 0 012-2h8a2 2 0 012 2v6M8 19l-2 2M16 19l2 2M9 19h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-6M22 20V14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconLocate({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21a9 9 0 100-18 9 9 0 000 18z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 13a1 1 0 100-2 1 1 0 000 2zM12 9V3M12 21v-2M3 12h2M19 12h-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MapStatusStrip({
  entryCount,
  totalRentInr,
  onLiveStats,
}: {
  entryCount: number;
  totalRentInr: number;
  onLiveStats: () => void;
}) {
  return (
    <div className="pointer-events-auto rounded-2xl bg-gradient-to-r from-[#5b21b6]/90 via-[#7C3AED]/85 to-[#4c1d95]/90 px-3 py-2.5 text-[11px] font-medium text-white shadow-lg shadow-black/30 ring-1 ring-white/10 sm:text-xs">
      <span className="opacity-95">Tap map to pin</span>
      <span className="mx-1.5 opacity-50">|</span>
      <span className="font-semibold tabular-nums">{formatTotalPinned(totalRentInr)}</span>
      <span className="opacity-90"> rent pinned</span>
      <span className="mx-1.5 opacity-50">|</span>
      <span className="opacity-80">{entryCount} pins</span>
      <span className="mx-1.5 opacity-50">|</span>
      <button
        type="button"
        onClick={onLiveStats}
        className="font-semibold text-[#c4b5fd] underline decoration-[#c4b5fd]/50 underline-offset-2 transition hover:text-white"
      >
        Live stats
      </button>
    </div>
  );
}

export function MapFloatingStack({
  heatmapOn,
  onGreenCover,
  onFlatHunt,
  metroOn,
  onMetro,
  onAreaStats,
  onLocate,
}: {
  heatmapOn: boolean;
  onGreenCover: () => void;
  onFlatHunt: () => void;
  metroOn: boolean;
  onMetro: () => void;
  onAreaStats: () => void;
  onLocate: () => void;
}) {
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-800 shadow-lg shadow-black/20 transition hover:bg-zinc-50 active:scale-[0.96] dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-900";

  return (
    <div className="pointer-events-auto absolute right-3 top-[38%] z-40 flex -translate-y-1/2 flex-col gap-2 sm:right-4">
      <button
        type="button"
        className={clsx(btn, heatmapOn && "ring-2 ring-[#10B981]")}
        onClick={onGreenCover}
        title="Green cover — rent heatmap"
        aria-pressed={heatmapOn}
      >
        <IconLeaf className="text-[#10B981]" />
      </button>
      <button type="button" className={btn} onClick={onFlatHunt} title="Flat hunt — focus search">
        <IconSearch className="text-zinc-700" />
      </button>
      <button
        type="button"
        className={clsx(btn, metroOn && "ring-2 ring-[#7C3AED]")}
        onClick={onMetro}
        title="Metro lines"
        aria-pressed={metroOn}
      >
        <IconTrain className="text-zinc-700" />
      </button>
      <button type="button" className={btn} onClick={onAreaStats} title="Area stats">
        <IconChart className="text-zinc-700" />
      </button>
      <button type="button" className={btn} onClick={onLocate} title="Locate me">
        <IconLocate className="text-zinc-700" />
      </button>
    </div>
  );
}

function IconChevronDock({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg
      className={clsx(className, "transition-transform duration-200", up && "-scale-y-100")}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
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

export function MapBottomFindBar({
  onPrimary,
  onSeeker,
  onHowTo,
  builtBy,
  primaryLabel = "Find Flat or Tenants",
  primaryHint = "Tap to start →",
  seekerLabel = "Drop a Seeker Pin",
  seekerHint = "Looking for a flat? →",
  dockTitle = "Contribute",
  sectionAddRentTitle = "Add a rent",
  sectionSeekerTitle = "Looking for a flat?",
  expandDockAria = "Show more",
  collapseDockAria = "Hide panel",
  howToLabel = "How to use",
}: {
  onPrimary: () => void;
  onSeeker?: () => void;
  onHowTo: () => void;
  builtBy: string;
  primaryLabel?: string;
  primaryHint?: string;
  seekerLabel?: string;
  seekerHint?: string;
  dockTitle?: string;
  sectionAddRentTitle?: string;
  sectionSeekerTitle?: string;
  expandDockAria?: string;
  collapseDockAria?: string;
  howToLabel?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const barRef = useRef<HTMLDivElement | null>(null);

  const toggleExpanded = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t || !barRef.current) return;
      if (barRef.current.contains(t)) return;
      setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const rentBtnClass =
    "flex w-full min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-full border border-white/10 bg-[#121214] py-3.5 pl-4 pr-5 text-sm font-semibold text-white shadow-2xl shadow-black/50 ring-1 ring-white/10 transition hover:bg-[#1a1a1f] active:scale-[0.99]";
  const seekerBtnClass =
    "flex w-full min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-gradient-to-b from-violet-500/15 to-violet-700/15 py-3 pl-4 pr-5 text-sm font-semibold text-violet-100 shadow-lg shadow-black/30 ring-1 ring-white/5 backdrop-blur transition hover:from-violet-500/25 hover:to-violet-700/25 active:scale-[0.99]";

  return (
    <div
      ref={barRef}
      className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-40 w-[min(100%-1.5rem,420px)] -translate-x-1/2 sm:bottom-[5.25rem]"
    >
      {!expanded ? (
        <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#121214]/95 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-md">
          <button type="button" onClick={onPrimary} className={clsx(rentBtnClass, "rounded-none border-0 shadow-none ring-0")}>
            <span className="text-lg" aria-hidden>
              🏠
            </span>
            <span className="flex-1 text-left">
              {primaryLabel}
              <span className="ml-2 text-[#a78bfa]">{primaryHint}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={false}
            aria-label={expandDockAria}
            title={expandDockAria}
            className="flex w-[52px] shrink-0 items-center justify-center border-l border-white/10 bg-zinc-900/80 text-zinc-300 transition hover:bg-zinc-800 hover:text-white active:scale-[0.98]"
          >
            <IconChevronDock up={false} className="text-teal-300" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#121214]/95 p-2.5 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-md sm:p-3">
          <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              {dockTitle}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded={expanded}
              aria-label={collapseDockAria}
              title={collapseDockAria}
              className="flex h-9 min-h-[36px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <IconChevronDock up className="text-teal-300" />
            </button>
          </div>

          <div className="space-y-3 px-0.5">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {sectionAddRentTitle}
              </p>
              <button type="button" onClick={onPrimary} className={rentBtnClass}>
                <span className="text-lg" aria-hidden>
                  🏠
                </span>
                <span className="flex-1 text-left">
                  {primaryLabel}
                  <span className="ml-2 text-[#a78bfa]">{primaryHint}</span>
                </span>
              </button>
            </div>

            {onSeeker ? (
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {sectionSeekerTitle}
                </p>
                <button type="button" onClick={onSeeker} className={seekerBtnClass}>
                  <span className="text-lg" aria-hidden>
                    📍
                  </span>
                  <span className="flex-1 text-left">
                    {seekerLabel}
                    <span className="ml-2 text-violet-300/90">{seekerHint}</span>
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-1 pb-0.5 pt-2 text-[10px] text-zinc-500">
            <button
              type="button"
              onClick={onHowTo}
              className="min-h-[44px] touch-manipulation px-1 font-medium text-zinc-400 underline-offset-2 hover:text-[#7C3AED] hover:underline"
            >
              {howToLabel}
            </button>
            <span className="text-zinc-600">
              Built by <span className="text-[#7C3AED]">{builtBy}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
