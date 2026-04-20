"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ActionPanel } from "@/components/map/ActionPanel";
import { VerificationBadge } from "@/components/map/VerificationBadge";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { formatInr } from "@/lib/format";
import { computeConfidence } from "@/lib/rent-engine";
import { useRentStore } from "@/store/useRentStore";
import type { RentEntry, VerificationStatus } from "@/types/rent";
import { useMemo, useRef, useState } from "react";

function confidenceBadge(level: string) {
  if (level === "high")
    return "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40";
  if (level === "medium")
    return "bg-amber-500/20 text-amber-100 ring-amber-500/35";
  return "bg-rose-500/20 text-rose-100 ring-rose-500/35";
}

function formatPinDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function PinDetailSheet({
  open,
  onClose,
  entry,
  allEntries,
}: {
  open: boolean;
  onClose: () => void;
  entry: RentEntry | null;
  allEntries: RentEntry[];
}) {
  const { t } = useLocale();
  const updateEntryFields = useRentStore((s) => s.updateEntryFields);
  const setSelectedEntry = useRentStore((s) => s.setSelectedEntry);
  const setMapFilters = useRentStore((s) => s.setMapFilters);
  const [reported, setReported] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const lastEntryIdRef = useRef<string | null>(null);

  if (lastEntryIdRef.current !== (entry?.id ?? null)) {
    lastEntryIdRef.current = entry?.id ?? null;
    if (reported) setReported(false);
    if (confirmMsg) setConfirmMsg(null);
    if (confirmError) setConfirmError(null);
  }

  const conf = useMemo(() => {
    if (!entry) return null;
    return computeConfidence(entry, allEntries);
  }, [entry, allEntries]);

  const report = async () => {
    if (!entry) return;
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/rents/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!res.ok) {
        setReported(false);
        return;
      }
      setReported(true);
    } catch {
      /* ignore */
    }
  };

  const confirm = async () => {
    if (!entry || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    setConfirmMsg(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/rents/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify({ id: entry.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        alreadyConfirmed?: boolean;
        confirmations_count?: number;
        verification_status?: string;
        last_updated?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.ok) {
        setConfirmError(data.error ?? t("confirmError"));
        return;
      }
      if (typeof data.confirmations_count === "number") {
        updateEntryFields(entry.id, {
          confirmations_count: data.confirmations_count,
          verification_status:
            (data.verification_status as VerificationStatus | undefined) ??
            entry.verification_status ??
            "self-reported",
          last_updated: data.last_updated ?? new Date().toISOString(),
        });
      }
      setConfirmMsg(
        data.alreadyConfirmed ? t("confirmAlready") : t("confirmThanks"),
      );
    } catch {
      setConfirmError(t("confirmError"));
    } finally {
      setConfirming(false);
    }
  };

  if (!entry) return null;

  const verificationStatus: VerificationStatus =
    entry.verification_status ?? "self-reported";
  const confirmationsCount = entry.confirmations_count ?? 0;
  const lastUpdatedIso = entry.last_updated ?? entry.created_at;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      variant="mapPlace"
      title={entry.area_label?.trim() || "Rent pin"}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl border border-white/15 bg-white/10 py-3.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/15 active:scale-[0.99]"
        >
          Close
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-white">
              {formatInr(entry.rent_inr)}
              <span className="ml-2 text-base font-medium text-zinc-400">
                /mo · {entry.bhk}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Submitted {formatPinDate(entry.created_at) || "—"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <VerificationBadge
              status={verificationStatus}
              confirmations={confirmationsCount}
              lastUpdatedIso={lastUpdatedIso}
            />
            {entry.women_only ? (
              <span className="rounded-full bg-fuchsia-500/25 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100 ring-1 ring-fuchsia-400/40">
                {t("womenOnlyBadge")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {t("confirmTitle")}
              </p>
              <p className="mt-0.5 text-xs text-zinc-300">
                {t("confirmBody").replace("{count}", String(confirmationsCount))}
              </p>
              {confirmMsg ? (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-300">
                  {confirmMsg}
                </p>
              ) : null}
              {confirmError ? (
                <p className="mt-1.5 text-[11px] font-medium text-rose-300">
                  {confirmError}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={confirming}
              onClick={() => void confirm()}
              className="shrink-0 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirming ? t("confirmInFlight") : t("confirmCta")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {entry.furnishing ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-200 ring-1 ring-white/10">
              {entry.furnishing}
            </span>
          ) : null}
          {entry.broker_or_owner ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-200 ring-1 ring-white/10">
              {entry.broker_or_owner}
            </span>
          ) : null}
          {entry.move_in_month ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-200 ring-1 ring-white/10">
              Moved {entry.move_in_month}
            </span>
          ) : null}
          {entry.maintenance_inr != null ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-200 ring-1 ring-white/10">
              Maint {formatInr(entry.maintenance_inr)}/mo
            </span>
          ) : null}
          {entry.deposit_inr != null ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-200 ring-1 ring-white/10">
              Deposit {formatInr(entry.deposit_inr)}
            </span>
          ) : null}
        </div>

        {conf ? (
          <div
            className={`rounded-xl px-3 py-2.5 text-sm ring-1 ${confidenceBadge(conf.level)}`}
          >
            <p className="font-semibold capitalize">
              {conf.level} confidence
              {conf.clusterVerified ? (
                <span className="ml-2 rounded-md bg-teal-500/25 px-1.5 py-0.5 text-xs font-semibold text-teal-100 ring-1 ring-teal-400/40">
                  Cluster verified
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs opacity-90">{conf.reason}</p>
            <p className="mt-1 text-[11px] opacity-75">Score: {conf.score}/100</p>
          </div>
        ) : null}

        <ActionPanel
          entry={entry}
          allEntries={allEntries}
          onSelectEntry={(e) => setSelectedEntry(e)}
          onSeeCheaperNearby={({ bhk, rentMax }) => {
            setMapFilters({ bhk, rentMax });
            onClose();
          }}
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={reported}
            onClick={() => void report()}
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
          >
            {reported ? "Thanks — we’ll review" : "Report incorrect data"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
