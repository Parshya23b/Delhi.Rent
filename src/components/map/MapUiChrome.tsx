"use client";

import clsx from "clsx";

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

export function MapBottomFindBar({
  onPrimary,
  onHowTo,
  builtBy,
}: {
  onPrimary: () => void;
  onHowTo: () => void;
  builtBy: string;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-40 flex w-[min(100%-1.5rem,420px)] -translate-x-1/2 flex-col items-center gap-2 sm:bottom-[5.25rem]">
      <button
        type="button"
        onClick={onPrimary}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-[#121214] py-3.5 pl-4 pr-5 text-sm font-semibold text-white shadow-2xl shadow-black/50 ring-1 ring-white/10 transition hover:bg-[#1a1a1f] active:scale-[0.99]"
      >
        <span className="text-lg" aria-hidden>
          🏠
        </span>
        <span className="flex-1 text-left">
          Find Flat or Tenants
          <span className="ml-2 text-[#a78bfa]">Tap to start →</span>
        </span>
      </button>
      <div className="flex w-full items-center justify-between px-1 text-[10px] text-zinc-500">
        <button
          type="button"
          onClick={onHowTo}
          className="font-medium text-zinc-400 underline-offset-2 hover:text-[#7C3AED] hover:underline"
        >
          How to use
        </button>
        <span className="text-zinc-600">
          Built by <span className="text-[#7C3AED]">{builtBy}</span>
        </span>
      </div>
    </div>
  );
}
