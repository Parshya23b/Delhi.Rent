"use client";

import clsx from "clsx";
import type { VerificationStatus } from "@/types/rent";

type Size = "sm" | "md";

const STATUS_META: Record<
  VerificationStatus,
  { label: string; dotClass: string; pillClass: string; ringClass: string }
> = {
  unverified: {
    label: "Unverified",
    dotClass: "bg-zinc-400",
    pillClass: "bg-zinc-500/20 text-zinc-200",
    ringClass: "ring-zinc-400/30",
  },
  "self-reported": {
    label: "Self-reported",
    dotClass: "bg-amber-400",
    pillClass: "bg-amber-500/20 text-amber-100",
    ringClass: "ring-amber-400/40",
  },
  verified_document: {
    label: "Verified",
    dotClass: "bg-emerald-400",
    pillClass: "bg-emerald-500/20 text-emerald-100",
    ringClass: "ring-emerald-400/45",
  },
};

function daysAgoLabel(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "recently";
  const days = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.round(days / 365);
  return `${years} yr ago`;
}

export function verificationTooltip(
  status: VerificationStatus,
  confirmations: number,
  lastUpdatedIso: string | null | undefined,
): string {
  const verified = `Verified by ${confirmations} ${confirmations === 1 ? "user" : "users"}`;
  const updated = `Updated ${daysAgoLabel(lastUpdatedIso)}`;
  const statusLabel =
    status === "verified_document"
      ? "Document verified"
      : status === "self-reported"
        ? "Self-reported"
        : "Unverified";
  return `${statusLabel} · ${verified} · ${updated}`;
}

export function VerificationBadge({
  status,
  confirmations,
  lastUpdatedIso,
  size = "md",
  withTooltip = true,
  className,
}: {
  status: VerificationStatus;
  confirmations: number;
  lastUpdatedIso: string | null | undefined;
  size?: Size;
  withTooltip?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const tooltip = withTooltip
    ? verificationTooltip(status, confirmations, lastUpdatedIso)
    : undefined;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 leading-none whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        meta.pillClass,
        meta.ringClass,
        className,
      )}
      title={tooltip}
      aria-label={tooltip}
    >
      <span
        className={clsx(
          "inline-block rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          meta.dotClass,
        )}
      />
      {meta.label}
      {confirmations > 0 ? (
        <span className="tabular-nums opacity-80">· {confirmations}</span>
      ) : null}
    </span>
  );
}

/** Dot-only variant for map markers. */
export function VerificationDot({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={clsx(
        "inline-block h-2 w-2 rounded-full ring-2 ring-[#121214]",
        meta.dotClass,
        className,
      )}
      aria-hidden
    />
  );
}

export function verificationDotColor(status: VerificationStatus): string {
  if (status === "verified_document") return "#34d399";
  if (status === "self-reported") return "#fbbf24";
  return "#a1a1aa";
}
