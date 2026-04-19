"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MapFilterState } from "@/lib/filter-entries";
import { BHK_OPTIONS, FURNISHING_OPTIONS } from "@/types/rent";
import clsx from "clsx";

const selectClass =
  "min-w-0 flex-1 cursor-pointer appearance-none rounded-xl border border-white/15 bg-white/70 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 shadow-sm outline-none ring-teal-500/20 transition focus:ring-2 dark:border-white/10 dark:bg-slate-900/60 dark:text-zinc-100 dark:ring-teal-400/30";

const iconWrap = "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-zinc-400";

function IconBed({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10v9M3 10v-2a2 2 0 012-2h2M3 10h18M21 10v9M21 10v-2a2 2 0 00-2-2h-2M7 8V6a2 2 0 012-2h6a2 2 0 012 2v2M7 16h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSofa({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 18V6a2 2 0 012-2h12a2 2 0 012 2v12M4 18h-1v2M4 18h16M20 18h1v-2M8 10h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRupee({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 8h10M7 12h6M7 16h10M9 4l-2 4h10l-2-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MapFiltersBar({
  value,
  onChange,
}: {
  value: MapFilterState;
  onChange: (p: Partial<MapFilterState>) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="pointer-events-auto flex min-w-0 flex-wrap items-stretch gap-2">
      <div className="relative min-w-[110px] flex-1 sm:min-w-[130px] sm:flex-none">
        <span className={iconWrap}>
          <IconBed />
        </span>
        <select
          className={clsx(selectClass, "w-full")}
          value={value.bhk}
          onChange={(e) =>
            onChange({ bhk: e.target.value === "all" ? "all" : e.target.value })
          }
          aria-label="BHK"
        >
          <option value="all">BHK · all</option>
          {BHK_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="relative min-w-[120px] flex-1 sm:min-w-[140px] sm:flex-none">
        <span className={iconWrap}>
          <IconSofa />
        </span>
        <select
          className={clsx(selectClass, "w-full")}
          value={value.furnishing}
          onChange={(e) =>
            onChange({
              furnishing: e.target.value === "all" ? "all" : e.target.value,
            })
          }
          aria-label="Furnishing"
        >
          <option value="all">Furn · all</option>
          {FURNISHING_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="relative min-w-[5.5rem] flex-1 sm:w-24 sm:flex-none">
        <span className={iconWrap}>
          <IconRupee />
        </span>
        <input
          type="number"
          className={clsx(selectClass, "w-full pl-9 pr-2")}
          placeholder="Min ₹"
          value={value.rentMin ?? ""}
          onChange={(e) =>
            onChange({
              rentMin: e.target.value ? Number(e.target.value) : null,
            })
          }
          aria-label="Minimum rent"
        />
      </div>
      <div className="relative min-w-[5.5rem] flex-1 sm:w-24 sm:flex-none">
        <span className={iconWrap}>
          <IconRupee />
        </span>
        <input
          type="number"
          className={clsx(selectClass, "w-full pl-9 pr-2")}
          placeholder="Max ₹"
          value={value.rentMax ?? ""}
          onChange={(e) =>
            onChange({
              rentMax: e.target.value ? Number(e.target.value) : null,
            })
          }
          aria-label="Maximum rent"
        />
      </div>
      <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/70 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-zinc-200">
        <span className="text-slate-500 dark:text-zinc-400">
          <IconCalendar />
        </span>
        <input
          type="checkbox"
          className="size-3.5 shrink-0 rounded border-zinc-300 accent-teal-600 dark:border-zinc-600"
          checked={value.last12MonthsOnly}
          onChange={(e) => onChange({ last12MonthsOnly: e.target.checked })}
        />
        <span className="hidden min-[380px]:inline">{t("last12m")}</span>
        <span className="min-[380px]:hidden">12m</span>
      </label>
      <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-2 rounded-xl border border-fuchsia-500/35 bg-fuchsia-500/15 px-3 py-2 text-xs font-semibold text-fuchsia-100 shadow-sm ring-1 ring-fuchsia-400/20">
        <input
          type="checkbox"
          className="size-3.5 shrink-0 rounded border-fuchsia-300/50 accent-fuchsia-500"
          checked={value.womenOnly}
          onChange={(e) => onChange({ womenOnly: e.target.checked })}
        />
        <span className="hidden min-[400px]:inline">{t("womenOnlyFilter")}</span>
        <span className="min-[400px]:hidden">{t("womenOnlyShort")}</span>
      </label>
      <details className="group w-full basis-full rounded-xl border border-white/10 bg-black/25 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-fuchsia-200/95 sm:text-xs">
          <span className="underline-offset-2 group-open:underline">
            {t("womenOnlyFilter")} — {t("womenOnlyLearnMore")}
          </span>
        </summary>
        <p className="border-t border-white/10 px-3 pb-2.5 pt-2 text-[11px] leading-snug text-zinc-200/95 sm:text-xs">
          {t("womenOnlyBlurb")}
        </p>
      </details>
    </div>
  );
}
