"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { formatInr } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import { computeConfidence } from "@/lib/rent-engine";
import type { RentEntry } from "@/types/rent";
import { useMemo, useState } from "react";

function confidenceBadge(level: string) {
  if (level === "high")
    return "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40";
  if (level === "medium")
    return "bg-amber-500/20 text-amber-100 ring-amber-500/35";
  return "bg-rose-500/20 text-rose-100 ring-rose-500/35";
}

const NEARBY_KM = 1.8;

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
  const [reported, setReported] = useState(false);

  const conf = useMemo(() => {
    if (!entry) return null;
    return computeConfidence(entry, allEntries);
  }, [entry, allEntries]);

  const recentNearby = useMemo(() => {
    if (!entry) return [];
    return allEntries
      .filter((e) => {
        if (e.id === entry.id) return false;
        return distanceKm(entry.lat, entry.lng, e.lat, e.lng) <= NEARBY_KM;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 8);
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

  if (!entry) return null;

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
          {entry.women_only ? (
            <span className="shrink-0 rounded-full bg-fuchsia-500/25 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100 ring-1 ring-fuchsia-400/40">
              {t("womenOnlyBadge")}
            </span>
          ) : null}
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

        {recentNearby.length > 0 ? (
          <div className="border-t border-white/10 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Most recent nearby
            </p>
            <ul className="mt-2 space-y-2 text-xs">
              {recentNearby.map((e) => (
                <li
                  key={e.id}
                  className="flex justify-between gap-2 text-zinc-300"
                >
                  <span>
                    {formatInr(e.rent_inr)} · {e.bhk}
                  </span>
                  <span className="shrink-0 text-zinc-500">
                    {formatPinDate(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
