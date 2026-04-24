import { rentShortLabel } from "@/lib/rent-supercluster";
import type { SeekerMapPin } from "@/lib/supabase/get-seeker-pins";

const SKY = "#0ea5e9";
const DEEP = "#0c4a6e";

const base =
  "font-sans text-center leading-tight select-none cursor-pointer transition-transform active:scale-[0.97]";

/** Distinct from rent pills: cyan “SEEKING” badge + bordered pill (demand / budget). */
export function createSeekerPinMarkerElement(
  pin: SeekerMapPin,
  onClick: (e: MouseEvent) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = base;
  wrap.style.cssText =
    "position:relative;display:flex;flex-direction:column;align-items:center;";

  const badge = document.createElement("div");
  badge.textContent = "SEEKING";
  badge.style.cssText = [
    `background:${SKY}`,
    "color:#fff",
    "font-size:8px",
    "font-weight:800",
    "letter-spacing:0.08em",
    "padding:3px 8px",
    "border-radius:6px",
    "margin-bottom:4px",
    "box-shadow:0 2px 10px rgba(14,165,233,0.5)",
  ].join(";");

  const budgetLbl = rentShortLabel(Math.round(pin.budget));
  const bhkLine =
    pin.bhk != null && pin.bhk >= 0 ? `${pin.bhk} BHK max` : "Any BHK";

  const pill = document.createElement("div");
  pill.style.cssText = [
    `background:${DEEP}`,
    "border-radius:9999px",
    "border:2px solid rgba(14,165,233,0.9)",
    "padding:8px 12px",
    "color:#e0f2fe",
    "font-size:11px",
    "font-weight:700",
    "white-space:nowrap",
    "box-shadow:0 4px 14px rgba(0,0,0,0.45)",
  ].join(";");
  pill.textContent = `${bhkLine} · ${budgetLbl}`;

  wrap.appendChild(badge);
  wrap.appendChild(pill);
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick(e as MouseEvent);
  });
  return wrap;
}
