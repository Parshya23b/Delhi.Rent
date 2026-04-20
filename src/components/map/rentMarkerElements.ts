import type { RentEntry } from "@/types/rent";
import { avlbFromCount, isPinNew, rentShortLabel } from "@/lib/rent-supercluster";
import { verificationDotColor } from "@/components/map/VerificationBadge";
import { verificationTooltip } from "@/components/map/VerificationBadge";

const BG = "#121214";
const ORANGE = "#F59E0B";
const GREEN = "#10B981";
const PURPLE = "#7C3AED";

const basePill =
  "font-sans text-center leading-tight select-none cursor-pointer transition-transform active:scale-[0.97]";

export function createClusterMarkerElement(
  count: number,
  onClick: (e: MouseEvent) => void,
): HTMLElement {
  const avlb = avlbFromCount(count);
  const wrap = document.createElement("div");
  wrap.className = basePill;
  wrap.style.cssText = [
    `background:${BG}`,
    "border-radius:9999px",
    "padding:8px 14px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06)",
    "color:#fff",
    "font-size:11px",
    "font-weight:700",
    "min-width:78px",
  ].join(";");
  wrap.innerHTML = `<div>${count} flats</div><div style="opacity:0.88;font-size:10px;font-weight:600;margin-top:2px">AVLB ${avlb}</div>`;
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return wrap;
}

export function createPointMarkerElement(
  entry: RentEntry,
  onClick: (e: MouseEvent) => void,
): HTMLElement {
  const rentLabel = rentShortLabel(entry.rent_inr);
  const line = `${entry.bhk} · ${rentLabel}`;
  const isRoomAvail = Boolean(entry.women_only);
  const isNew = isPinNew(entry.created_at);

  const wrap = document.createElement("div");
  wrap.className = basePill;
  wrap.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;";

  if (isRoomAvail) {
    const badge = document.createElement("div");
    badge.textContent = "ROOM AVAIL";
    badge.style.cssText = [
      `background:${GREEN}`,
      "color:#fff",
      "font-size:8px",
      "font-weight:800",
      "letter-spacing:0.04em",
      "padding:3px 8px",
      "border-radius:6px",
      "margin-bottom:4px",
      "box-shadow:0 2px 8px rgba(16,185,129,0.45)",
    ].join(";");
    wrap.appendChild(badge);
  }

  const pill = document.createElement("div");
  pill.style.cssText = [
    isRoomAvail ? `background:${ORANGE}` : `background:${BG}`,
    "border-radius:9999px",
    "padding:8px 12px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.08)",
    "color:#fff",
    "font-size:11px",
    "font-weight:700",
    "white-space:nowrap",
    "position:relative",
  ].join(";");
  pill.textContent = line;

  const status = entry.verification_status ?? "self-reported";
  const dotColor = verificationDotColor(status);
  const dot = document.createElement("span");
  dot.style.cssText = [
    "position:absolute",
    "top:-3px",
    "right:-3px",
    "width:9px",
    "height:9px",
    "border-radius:9999px",
    `background:${dotColor}`,
    `box-shadow:0 0 0 2px ${BG}`,
    "pointer-events:none",
  ].join(";");
  pill.appendChild(dot);

  pill.title = verificationTooltip(
    status,
    entry.confirmations_count ?? 0,
    entry.last_updated ?? entry.created_at,
  );
  wrap.appendChild(pill);

  if (isNew) {
    const neu = document.createElement("div");
    neu.textContent = "NEW";
    neu.style.cssText = [
      `background:${PURPLE}`,
      "color:#fff",
      "font-size:8px",
      "font-weight:800",
      "padding:2px 6px",
      "border-radius:4px",
      "position:absolute",
      "left:-2px",
      "bottom:-4px",
      "box-shadow:0 2px 6px rgba(124,58,237,0.5)",
    ].join(";");
    wrap.appendChild(neu);
  }

  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return wrap;
}
