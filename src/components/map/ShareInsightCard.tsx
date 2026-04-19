"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInrShort } from "@/lib/format";
import { toPng } from "html-to-image";
import { useCallback, useRef, useState } from "react";

export function ShareInsightCard({
  bhk,
  area,
  avg,
  min,
  max,
}: {
  bhk: string;
  area: string;
  avg: number;
  min: number;
  max: number;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const text = `${bhk} in ${area}\nAvg rent: ${formatInrShort(avg)}\nRange: ${formatInrShort(min)}–${formatInrShort(max)}\n${t("shareReferral")}\n— delhi.rent`;

  const shareWhatsapp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const copyImage = useCallback(async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch {
      /* clipboard image may fail on some browsers */
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 to-zinc-900 p-4 text-white shadow-inner"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-100/90">
          delhi.rent
        </p>
        <p className="mt-2 text-lg font-bold leading-snug">
          {bhk} in {area}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] text-teal-100/80">Avg rent</p>
            <p className="text-xl font-semibold">{formatInrShort(avg)}</p>
          </div>
          <div>
            <p className="text-[11px] text-teal-100/80">Range</p>
            <p className="text-lg font-semibold">
              {formatInrShort(min)} – {formatInrShort(max)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-snug text-teal-100/90">{t("shareReferral")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shareWhatsapp}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void copyText()}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm"
        >
          Copy text
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void copyImage()}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm disabled:opacity-60"
        >
          {busy ? "Copying…" : "Copy image"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        Image copy works in Chromium-based browsers; otherwise use WhatsApp or copy text.
      </p>
      <p className="text-[10px] text-zinc-400">{t("futureEmail")}</p>
    </div>
  );
}
