"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type {
  SeekerBhkPref,
  SeekerFlatmateGender,
  SeekerFoodPref,
  SeekerGender,
  SeekerLookingFor,
  SeekerMoveIn,
  SeekerPin,
  SeekerSmokePref,
} from "@/types/seeker";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";

type FieldKey =
  | "looking_for"
  | "budget_inr"
  | "bhk_pref"
  | "move_in_timeline"
  | "food_pref"
  | "smoke_pref"
  | "self_gender"
  | "pref_flatmate_gender"
  | "lifestyle_note"
  | "email"
  | "phone"
  | "general";

interface SeekerPinSheetProps {
  open: boolean;
  onClose: () => void;
  draft: { lat: number; lng: number; areaLabel: string } | null;
  onSubmitted?: (seeker: SeekerPin) => void;
}

interface ChipOption<V extends string> {
  value: V;
  label: string;
  icon?: string;
}

function Asterisk() {
  return (
    <span className="ml-0.5 text-rose-400" aria-hidden>
      *
    </span>
  );
}

function FieldLabel({
  htmlFor,
  required,
  hint,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2.5 flex flex-wrap items-baseline gap-x-2 text-[15px] font-medium text-zinc-100"
    >
      <span>
        {children}
        {required ? <Asterisk /> : null}
      </span>
      {hint ? (
        <span className="text-[13px] font-normal text-zinc-400">{hint}</span>
      ) : null}
    </label>
  );
}

function ChipRow<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ChipOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2.5"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={clsx(
              "min-h-[44px] inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-medium transition-all duration-150 active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
              selected
                ? "border border-teal-400/70 bg-teal-500/90 text-white shadow-sm shadow-teal-900/40"
                : "border border-zinc-700/70 bg-zinc-900/40 text-zinc-200 hover:border-zinc-500/80 hover:bg-zinc-900/60",
            )}
          >
            {opt.icon ? (
              <span className="text-base leading-none" aria-hidden>
                {opt.icon}
              </span>
            ) : null}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  error,
  ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  inputMode?: "numeric" | "decimal" | "email" | "tel" | "text";
  autoComplete?: string;
  error?: string;
  ariaDescribedBy?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-invalid={Boolean(error)}
      aria-describedby={ariaDescribedBy}
      className={clsx(
        "block w-full rounded-xl border bg-zinc-900/50 px-4 py-3.5 text-[15px] text-zinc-100 outline-none transition placeholder:text-zinc-500",
        error
          ? "border-rose-500/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30"
          : "border-zinc-700/70 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/25",
      )}
    />
  );
}

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-rose-400">
      {msg}
    </p>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
      <path
        fill="currentColor"
        className="opacity-90"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}

function parseInr(raw: string): number {
  const n = Number(String(raw).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function SeekerPinSheet({ open, onClose, draft, onSubmitted }: SeekerPinSheetProps) {
  const { t } = useLocale();

  const [lookingFor, setLookingFor] = useState<SeekerLookingFor>("room_in_flat");
  const [budget, setBudget] = useState("");
  const [bhkPref, setBhkPref] = useState<SeekerBhkPref>("any");
  const [moveIn, setMoveIn] = useState<SeekerMoveIn>("flexible");
  const [foodPref, setFoodPref] = useState<SeekerFoodPref>("any");
  const [smokePref, setSmokePref] = useState<SeekerSmokePref | null>(null);
  const [selfGender, setSelfGender] = useState<SeekerGender | null>(null);
  const [prefMate, setPrefMate] = useState<SeekerFlatmateGender>("any");
  const [lifestyle, setLifestyle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const lookingForOpts: ChipOption<SeekerLookingFor>[] = useMemo(
    () => [
      { value: "whole_flat", label: t("seekerLookingForWhole") },
      { value: "room_in_flat", label: t("seekerLookingForRoom") },
    ],
    [t],
  );

  const bhkOpts: ChipOption<SeekerBhkPref>[] = useMemo(
    () => [
      { value: "1BHK", label: "1" },
      { value: "2BHK", label: "2" },
      { value: "3BHK", label: "3" },
      { value: "any", label: t("seekerAny") },
    ],
    [t],
  );

  const moveInOpts: ChipOption<SeekerMoveIn>[] = useMemo(
    () => [
      { value: "asap", label: t("seekerMoveInAsap") },
      { value: "next_month", label: t("seekerMoveInNextMonth") },
      { value: "flexible", label: t("seekerMoveInFlexible") },
    ],
    [t],
  );

  const foodOpts: ChipOption<SeekerFoodPref>[] = useMemo(
    () => [
      { value: "veg", label: t("seekerFoodVeg"), icon: "🌿" },
      { value: "non_veg", label: t("seekerFoodNonVeg"), icon: "🍗" },
      { value: "any", label: t("seekerAny") },
    ],
    [t],
  );

  const smokeOpts: ChipOption<SeekerSmokePref>[] = useMemo(
    () => [
      { value: "smoker", label: t("seekerSmokerYes"), icon: "🚬" },
      { value: "non_smoker", label: t("seekerSmokerNo"), icon: "🚭" },
      { value: "no_preference", label: t("seekerSmokerNoPref") },
    ],
    [t],
  );

  const genderOpts: ChipOption<SeekerGender>[] = useMemo(
    () => [
      { value: "male", label: t("seekerGenderMale") },
      { value: "female", label: t("seekerGenderFemale") },
      { value: "other", label: t("seekerGenderOther") },
    ],
    [t],
  );

  const mateGenderOpts: ChipOption<SeekerFlatmateGender>[] = useMemo(
    () => [
      { value: "male", label: t("seekerGenderMale") },
      { value: "female", label: t("seekerGenderFemale") },
      { value: "any", label: t("seekerAny") },
    ],
    [t],
  );

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const validate = (): Partial<Record<FieldKey, string>> => {
    const next: Partial<Record<FieldKey, string>> = {};
    const budgetNum = parseInr(budget);
    if (!budget.trim() || !Number.isFinite(budgetNum) || budgetNum < 1000) {
      next.budget_inr = t("seekerErrorBudget");
    } else if (budgetNum > 2_000_000) {
      next.budget_inr = t("seekerErrorBudget");
    }

    const phoneDigits = phone.replace(/[\s()\-+]/g, "");
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      next.email = t("seekerErrorEmail");
    }
    if (!/^[0-9]{7,15}$/.test(phoneDigits)) {
      next.phone = t("seekerErrorPhone");
    }
    if (lifestyle.length > 500) {
      next.lifestyle_note = t("seekerErrorLifestyle");
    }
    return next;
  };

  const submit = async () => {
    if (!draft) return;
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/seekers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify({
          lat: draft.lat,
          lng: draft.lng,
          area_label: draft.areaLabel || null,
          looking_for: lookingFor,
          budget_inr: parseInr(budget),
          bhk_pref: bhkPref,
          move_in_timeline: moveIn,
          food_pref: foodPref,
          smoke_pref: smokePref,
          self_gender: selfGender,
          pref_flatmate_gender: prefMate,
          lifestyle_note: lifestyle.trim() || null,
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await res.json()) as {
        seeker?: SeekerPin;
        error?: string;
        field?: FieldKey;
        retryAfterSec?: number;
      };
      if (!res.ok) {
        const f = (data.field ?? "general") as FieldKey;
        let msg = data.error ?? t("seekerErrorGeneral");
        if (data.retryAfterSec) {
          const mins = Math.max(1, Math.ceil(data.retryAfterSec / 60));
          msg = `${msg} (~${mins} min)`;
        }
        setErrors({ [f]: msg });
        setSubmitting(false);
        return;
      }
      if (data.seeker) {
        onSubmitted?.(data.seeker);
      }
      setSubmitted(true);
      setSubmitting(false);
    } catch {
      setErrors({ general: t("seekerErrorNetwork") });
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open && !!draft}
      onClose={handleClose}
      tall
      variant="mapPlace"
      footer={
        submitted ? (
          <div className="mx-auto flex w-full max-w-[560px] gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-2xl border border-zinc-700/70 bg-zinc-900/50 px-4 py-3.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800/70"
            >
              {t("seekerDone")}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[560px] flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-zinc-700/70 bg-zinc-900/40 px-4 py-3.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800/60 disabled:opacity-60 sm:flex-none sm:px-6"
            >
              {t("seekerCancel")}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 ring-1 ring-white/10 transition hover:from-violet-400 hover:to-violet-600 active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Spinner />
                  <span>{t("seekerSubmitting")}</span>
                </>
              ) : (
                <span>{t("seekerSubmit")}</span>
              )}
            </button>
          </div>
        )
      }
    >
      <div className="mx-auto w-full max-w-[560px]">
        {/* Custom header — title left, close right */}
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold tracking-tight text-white">
            {t("seekerTitle")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t("seekerClose")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/50 text-zinc-300 transition hover:bg-zinc-800/80 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="mb-6 text-[13px] leading-relaxed text-zinc-400">
          {t("seekerSubtitle")}
        </p>

        {submitted ? (
          <div
            role="status"
            className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-5 text-center"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5l4.5 4.5L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">
              {t("seekerThanksTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-300">
              {t("seekerThanksBody")}
            </p>
          </div>
        ) : (
          <div className="space-y-7 pb-2">
            {/* I'm looking for */}
            <section>
              <FieldLabel required>{t("seekerLookingFor")}</FieldLabel>
              <ChipRow
                options={lookingForOpts}
                value={lookingFor}
                onChange={(v) => {
                  setLookingFor(v);
                }}
                ariaLabel={t("seekerLookingFor")}
              />
            </section>

            {/* Budget */}
            <section>
              <FieldLabel htmlFor="seeker-budget" required>
                {lookingFor === "whole_flat"
                  ? t("seekerBudgetFlat")
                  : t("seekerBudgetRoom")}
              </FieldLabel>
              <TextInput
                id="seeker-budget"
                value={budget}
                onChange={(v) => {
                  setBudget(v);
                  if (errors.budget_inr) setErrors((p) => ({ ...p, budget_inr: undefined }));
                }}
                placeholder={t("seekerBudgetPlaceholder")}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                error={errors.budget_inr}
                ariaDescribedBy={errors.budget_inr ? "seeker-budget-err" : undefined}
              />
              <FieldError id="seeker-budget-err" msg={errors.budget_inr} />
            </section>

            {/* BHK */}
            <section>
              <FieldLabel>{t("seekerBhkPref")}</FieldLabel>
              <ChipRow
                options={bhkOpts}
                value={bhkPref}
                onChange={setBhkPref}
                ariaLabel={t("seekerBhkPref")}
              />
            </section>

            {/* Move-in */}
            <section>
              <FieldLabel>{t("seekerMoveIn")}</FieldLabel>
              <ChipRow
                options={moveInOpts}
                value={moveIn}
                onChange={setMoveIn}
                ariaLabel={t("seekerMoveIn")}
              />
            </section>

            {/* Food */}
            <section>
              <FieldLabel>{t("seekerFood")}</FieldLabel>
              <ChipRow
                options={foodOpts}
                value={foodPref}
                onChange={setFoodPref}
                ariaLabel={t("seekerFood")}
              />
            </section>

            {/* Smoke */}
            <section>
              <FieldLabel>{t("seekerSmoke")}</FieldLabel>
              <ChipRow
                options={smokeOpts}
                value={smokePref}
                onChange={setSmokePref}
                ariaLabel={t("seekerSmoke")}
              />
            </section>

            {/* Self gender */}
            <section>
              <FieldLabel hint={t("seekerYouAreHint")}>{t("seekerYouAre")}</FieldLabel>
              <ChipRow
                options={genderOpts}
                value={selfGender}
                onChange={setSelfGender}
                ariaLabel={t("seekerYouAre")}
              />
            </section>

            {/* Preferred flatmate gender */}
            <section>
              <FieldLabel>{t("seekerMateGender")}</FieldLabel>
              <ChipRow
                options={mateGenderOpts}
                value={prefMate}
                onChange={setPrefMate}
                ariaLabel={t("seekerMateGender")}
              />
            </section>

            {/* Lifestyle */}
            <section>
              <FieldLabel htmlFor="seeker-lifestyle" hint={t("seekerLifestyleHint")}>
                {t("seekerLifestyle")}
              </FieldLabel>
              <textarea
                id="seeker-lifestyle"
                value={lifestyle}
                onChange={(e) => setLifestyle(e.target.value)}
                placeholder={t("seekerLifestylePlaceholder")}
                rows={4}
                maxLength={500}
                className={clsx(
                  "block w-full rounded-xl border bg-zinc-900/50 px-4 py-3.5 text-[15px] leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-500",
                  errors.lifestyle_note
                    ? "border-rose-500/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30"
                    : "border-zinc-700/70 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/25",
                )}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">
                {t("seekerLifestyleHelp")}
              </p>
              <FieldError id="seeker-lifestyle-err" msg={errors.lifestyle_note} />
            </section>

            {/* Divider */}
            <hr className="border-zinc-800/80" />

            {/* Email */}
            <section>
              <FieldLabel htmlFor="seeker-email" required>
                {t("seekerEmail")}
              </FieldLabel>
              <TextInput
                id="seeker-email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="you@gmail.com"
                type="email"
                inputMode="email"
                autoComplete="email"
                error={errors.email}
                ariaDescribedBy={errors.email ? "seeker-email-err" : undefined}
              />
              <FieldError id="seeker-email-err" msg={errors.email} />
            </section>

            {/* Phone */}
            <section>
              <FieldLabel htmlFor="seeker-phone" required>
                {t("seekerPhone")}
              </FieldLabel>
              <TextInput
                id="seeker-phone"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
                }}
                placeholder={t("seekerPhonePlaceholder")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                error={errors.phone}
                ariaDescribedBy={errors.phone ? "seeker-phone-err" : undefined}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">
                {t("seekerPhonePrivacy")}
              </p>
              <FieldError id="seeker-phone-err" msg={errors.phone} />
            </section>

            {/* General error */}
            {errors.general ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200"
              >
                {errors.general}
              </div>
            ) : null}

            {/* Pin metadata */}
            {draft ? (
              <p className="pt-1 text-center text-[11px] leading-relaxed text-zinc-500">
                {t("seekerPinAt")} {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                {draft.areaLabel ? ` · ${draft.areaLabel}` : ""}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
