"use client";

import { formatInr } from "@/lib/format";

export function OverpayBanner({
  open,
  onDismiss,
  userRent,
  median,
  pct,
}: {
  open: boolean;
  onDismiss: () => void;
  userRent: number;
  median: number;
  pct: number;
}) {
  if (!open) return null;
  const payingMore = pct > 0;

  return (
    <div className="pointer-events-auto fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 max-w-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <div
        className={`rounded-2xl px-4 py-3 shadow-lg ring-1 ${
          payingMore
            ? "bg-red-50 ring-red-200 dark:bg-red-950/50 dark:ring-red-800"
            : "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/50 dark:ring-emerald-800"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Rent truth check
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              You entered {formatInr(userRent)} · Area median ~ {formatInr(median)}
            </p>
            <p
              className={`mt-1 text-lg font-bold ${
                payingMore ? "text-red-700" : "text-emerald-800"
              }`}
            >
              {payingMore
                ? `~${Math.abs(pct)}% higher than typical nearby`
                : `~${Math.abs(pct)}% vs median — looks fair or better`}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
