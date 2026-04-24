"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { reverseGeocodeShort } from "@/lib/mapbox-geocode";
import {
  computeAreaStats,
  entriesNearPoint,
  overpayPercent,
} from "@/lib/rent-engine";
import { useRentStore } from "@/store/useRentStore";
import {
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  bhkLabelToCode,
  type RentEntry,
} from "@/types/rent";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";

type FormField =
  | "rent"
  | "maintenance"
  | "deposit"
  | "bhk"
  | "move_in_month"
  | "general";

const BROKER_OPTIONS = ["Owner", "Broker", "Unsure"] as const;

function parseInrInput(raw: string): number {
  const n = Number(String(raw).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 17a2 2 0 100-4 2 2 0 000 4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("animate-spin", className)}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/** Floating label + fixed ₹ prefix (numbers only in field). */
function RupeeField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  inputMode = "numeric",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="min-w-0">
      <div className="relative">
        <span
          className="pointer-events-none absolute bottom-3 left-3 z-[1] text-base font-semibold text-zinc-500 dark:text-zinc-400"
          aria-hidden
        >
          ₹
        </span>
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          placeholder=" "
          value={value}
          title={error || hint || undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            "peer block min-h-[3.5rem] w-full rounded-xl border bg-zinc-50 pb-2.5 pl-9 pr-3 pt-5 text-base text-zinc-900 outline-none transition placeholder:text-transparent dark:bg-zinc-900/80 dark:text-zinc-100",
            error
              ? "border-red-400 ring-2 ring-red-100 dark:border-red-500/70 dark:ring-red-950/50"
              : "border-zinc-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 dark:border-zinc-600 dark:focus:border-teal-400",
          )}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-9 top-4 z-[1] origin-[0] text-base font-medium text-zinc-500 transition-all duration-150 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-teal-700 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-zinc-600 dark:text-zinc-400 dark:peer-focus:text-teal-300 dark:peer-[:not(:placeholder-shown)]:text-zinc-300"
        >
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  allowClear,
  clearLabel,
  error,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
  clearLabel?: string;
  error?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{label}</p>
      <div
        className={clsx(
          "flex flex-wrap gap-2",
          error && "rounded-xl p-1 ring-2 ring-red-100 dark:ring-red-950/50",
        )}
        role="group"
        aria-label={label}
      >
        {allowClear ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className={clsx(
              "min-h-[2.75rem] rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.98]",
              value === ""
                ? "border-teal-600 bg-teal-600 text-white shadow-sm dark:border-teal-500 dark:bg-teal-600"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500",
            )}
          >
            {clearLabel}
          </button>
        ) : null}
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={clsx(
              "min-h-[2.75rem] rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.98]",
              value === opt
                ? "border-teal-600 bg-teal-600 text-white shadow-sm dark:border-teal-500 dark:bg-teal-600"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AddRentSheet({
  open,
  onClose,
  draft,
  allEntries,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  draft: { lat: number; lng: number; areaLabel: string } | null;
  allEntries: RentEntry[];
  onSubmitted: (
    entry: RentEntry,
    overpay: {
      pct: number;
      median: number;
      persisted: boolean;
      syncWarning?: string;
    },
  ) => void;
}) {
  const { t } = useLocale();
  const mergeEntries = useRentStore((s) => s.mergeEntries);
  const setHasContributed = useRentStore((s) => s.setHasContributed);
  const setLastSubmitted = useRentStore((s) => s.setLastSubmitted);

  const [rent, setRent] = useState("");
  const [bhk, setBhk] = useState<string>("2BHK");
  const [area, setArea] = useState(() => draft?.areaLabel ?? "");
  const [moveIn, setMoveIn] = useState("");
  const [broker, setBroker] = useState<string>("");
  const [furnishing, setFurnishing] = useState<string>("");
  const [maintenance, setMaintenance] = useState("");
  const [deposit, setDeposit] = useState("");
  const [optInBuilding, setOptInBuilding] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [additionalOpen, setAdditionalOpen] = useState(false);

  const monthBounds = useMemo(() => {
    const min = new Date();
    min.setFullYear(min.getFullYear() - 5);
    const max = new Date();
    max.setMonth(max.getMonth() + 24);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { min: fmt(min), max: fmt(max) };
  }, []);

  useEffect(() => {
    if (!open || !draft) return;
    let cancelled = false;
    void (async () => {
      const label = await reverseGeocodeShort(draft.lat, draft.lng);
      if (!cancelled) setArea((prev) => prev || draft.areaLabel || label);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, draft]);

  const clearFieldError = useCallback((f: FormField) => {
    setFieldErrors((prev) => {
      if (!prev[f]) return prev;
      const next = { ...prev };
      delete next[f];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setRent("");
    setBhk("2BHK");
    setArea("");
    setMoveIn("");
    setBroker("");
    setFurnishing("");
    setMaintenance("");
    setDeposit("");
    setOptInBuilding(false);
    setWomenOnly(false);
    setFieldErrors({});
    setAdditionalOpen(false);
  }, []);

  const setErrorForField = (field: FormField | undefined, message: string) => {
    const f: FormField = field ?? "general";
    setFieldErrors({ [f]: message });
    if (f === "maintenance" || f === "deposit") {
      setAdditionalOpen(true);
    }
  };

  const submit = async () => {
    if (!draft) return;
    setFieldErrors({});
    const rentNum = parseInrInput(rent);
    if (!rentNum || rentNum < 2000) {
      setFieldErrors({
        rent: "Enter a realistic monthly rent (numbers only; ₹ is filled in for you).",
      });
      return;
    }

    const maintenanceNum = maintenance.trim()
      ? Math.round(parseInrInput(maintenance))
      : null;
    const depositNum = deposit.trim() ? Math.round(parseInrInput(deposit)) : null;

    if (maintenance.trim() && (Number.isNaN(maintenanceNum!) || maintenanceNum! < 0)) {
      setAdditionalOpen(true);
      setFieldErrors({ maintenance: "Enter a valid amount or leave blank." });
      return;
    }
    if (deposit.trim() && (Number.isNaN(depositNum!) || depositNum! < 0)) {
      setAdditionalOpen(true);
      setFieldErrors({ deposit: "Enter a valid amount or leave blank." });
      return;
    }

    const bhkCode = bhkLabelToCode(bhk);
    if (bhkCode == null) {
      setFieldErrors({ bhk: "Choose a BHK type." });
      return;
    }

    const latNum = Number(draft.lat);
    const lngNum = Number(draft.lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setFieldErrors({ general: "Invalid map location. Tap the map again to place the pin." });
      return;
    }

    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();

      const payload: Record<string, unknown> = {
        lat: latNum,
        lng: lngNum,
        rent: Math.round(rentNum),
        bhk: bhkCode,
        opt_in_building_aggregate: optInBuilding,
        women_only: womenOnly,
      };
      const areaTrim = area.trim();
      if (areaTrim) payload.area_label = areaTrim;
      if (moveIn) payload.move_in_month = moveIn;
      const brokerTrim = broker.trim();
      if (brokerTrim) payload.broker_or_owner = brokerTrim;
      const furnishingTrim = furnishing.trim();
      if (furnishingTrim) payload.furnishing = furnishingTrim;
      if (maintenanceNum != null) payload.maintenance_inr = maintenanceNum;
      if (depositNum != null) payload.deposit_inr = depositNum;

      const res = await fetch("/api/rents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        field?: FormField;
        retryAfterSec?: number;
        entry?: RentEntry;
        persisted?: boolean;
        syncWarning?: string;
      };
      if (!res.ok) {
        let msg = data.error ?? "Could not submit";
        if (data.code === "COOLDOWN" && data.retryAfterSec != null) {
          const mins = Math.max(1, Math.ceil(data.retryAfterSec / 60));
          msg = `${msg} Try again in ~${mins} min.`;
        }
        setErrorForField(data.field, msg);
        setLoading(false);
        return;
      }
      const entry = data.entry as RentEntry;
      mergeEntries([entry]);
      setHasContributed(true);
      setLastSubmitted(entry);

      const near = entriesNearPoint(draft.lat, draft.lng, [...allEntries, entry], 2.5, bhk);
      const stats = computeAreaStats(near, area || "This area");
      const median = stats?.median ?? rentNum;
      const pct = overpayPercent(rentNum, median);

      onSubmitted(entry, {
        pct,
        median,
        persisted: data.persisted !== false,
        syncWarning: data.syncWarning,
      });
      reset();
      onClose();
    } catch {
      setFieldErrors({ general: "Network error. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      open={open && !!draft}
      onClose={onClose}
      title={t("addFormTitle")}
      tall
      disableHandleClose={loading}
      footer={
        <div className="mx-auto w-full max-w-[560px]">
          <button
            type="button"
            disabled={loading}
            onClick={() => void submit()}
            className="flex w-full min-h-[3rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-teal-500 to-teal-700 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/30 ring-1 ring-white/20 transition hover:from-teal-400 hover:to-teal-600 active:scale-[0.99] disabled:opacity-65 dark:shadow-black/40"
          >
            {loading ? (
              <>
                <Spinner className="text-white" />
                <span>{t("addFormSubmitting")}</span>
              </>
            ) : (
              t("addFormSubmit")
            )}
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[560px] space-y-8 pb-1">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("addFormSubtitle")}</p>

        <aside className="flex gap-3 rounded-2xl border border-teal-200/80 bg-teal-50/90 p-4 dark:border-teal-800/50 dark:bg-teal-950/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600/15 text-teal-800 dark:text-teal-200">
            <IconLock className="text-teal-700 dark:text-teal-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">{t("addFormPrivacyTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-teal-900/90 dark:text-teal-200/90">
              {t("addFormPrivacyBody")}
            </p>
          </div>
        </aside>

        <section className="space-y-6">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t("addFormSectionRent")}
          </h3>
          <RupeeField
            id="add-rent-inr"
            label={t("addFormMonthlyRent")}
            value={rent}
            onChange={(v) => {
              setRent(v);
              clearFieldError("rent");
            }}
            error={fieldErrors.rent}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6">
            <ChipGroup
              label={t("addFormBhk")}
              options={BHK_OPTIONS}
              value={bhk}
              onChange={(v) => {
                setBhk(v);
                clearFieldError("bhk");
              }}
              error={fieldErrors.bhk}
            />
            <ChipGroup
              label={t("addFormFurnishing")}
              options={FURNISHING_OPTIONS}
              value={furnishing}
              onChange={(v) => {
                setFurnishing(v);
              }}
              allowClear
              clearLabel={t("addFormFurnishingSkip")}
            />
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t("addFormSectionLocation")}
          </h3>
          <div>
            <label
              htmlFor="add-area"
              className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {t("addFormArea")}
            </label>
            <input
              id="add-area"
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100"
              placeholder="e.g. Saket, Dwarka"
              autoComplete="address-level2"
            />
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{t("addFormAreaHint")}</p>
          </div>

          <div>
            <label
              htmlFor="add-move-in"
              className="mb-1.5 block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {t("addFormMoveIn")}
            </label>
            <input
              id="add-move-in"
              type="month"
              min={monthBounds.min}
              max={monthBounds.max}
              value={moveIn}
              onChange={(e) => {
                setMoveIn(e.target.value);
                clearFieldError("move_in_month");
              }}
              className={clsx(
                "w-full max-w-full rounded-xl border bg-white px-3 py-3 text-base outline-none dark:bg-zinc-900/80 dark:text-zinc-100 sm:max-w-xs",
                fieldErrors.move_in_month
                  ? "border-red-400 ring-2 ring-red-100 dark:border-red-500/70 dark:ring-red-950/50"
                  : "border-zinc-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 dark:border-zinc-600",
              )}
            />
            {fieldErrors.move_in_month ? (
              <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                {fieldErrors.move_in_month}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{t("addFormMonthHint")}</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <ChipGroup
            label={t("addFormBroker")}
            options={BROKER_OPTIONS}
            value={broker}
            onChange={setBroker}
            allowClear
            clearLabel={t("addFormBrokerSkip")}
          />
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-4 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/20">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-fuchsia-400 accent-fuchsia-600"
            checked={womenOnly}
            onChange={(e) => setWomenOnly(e.target.checked)}
          />
          <span className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">{t("addWomenOnly")}</span>
        </label>

        <details
          className="group rounded-2xl border border-zinc-200/90 bg-zinc-50/60 open:shadow-sm dark:border-zinc-700 dark:bg-zinc-900/30"
          open={additionalOpen}
          onToggle={(e) => setAdditionalOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              <span>
                {t("addFormAdditional")}
                <span className="ml-2 block font-normal text-zinc-500 sm:inline dark:text-zinc-400">
                  ({t("addFormAdditionalHint")})
                </span>
              </span>
              <span className="text-zinc-400 transition group-open:rotate-180">▼</span>
            </span>
          </summary>
          <div className="space-y-5 border-t border-zinc-200 px-4 pb-5 pt-5 dark:border-zinc-700">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("addFormAdditionalLead")}</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
              <RupeeField
                id="add-maintenance-inr"
                label={t("addFormMaintenance")}
                value={maintenance}
                onChange={(v) => {
                  setMaintenance(v);
                  clearFieldError("maintenance");
                }}
                error={fieldErrors.maintenance}
                hint={t("addFormOptional")}
              />
              <RupeeField
                id="add-deposit-inr"
                label={t("addFormDeposit")}
                value={deposit}
                onChange={(v) => {
                  setDeposit(v);
                  clearFieldError("deposit");
                }}
                error={fieldErrors.deposit}
                hint={t("addFormOptional")}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 accent-teal-600 dark:border-zinc-600"
                checked={optInBuilding}
                onChange={(e) => setOptInBuilding(e.target.checked)}
              />
              <span>{t("addFormBuildingOptIn")}</span>
            </label>
          </div>
        </details>

        {fieldErrors.general ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {fieldErrors.general}
          </div>
        ) : null}

        {draft ? (
          <p className="text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            {t("addFormPinCoords")}: {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)} — {t("addFormPinHint")}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
