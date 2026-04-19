"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInrShort } from "@/lib/format";
import type { MonthPoint } from "@/lib/rent-trends";

export function TrendsMini({ points }: { points: MonthPoint[] }) {
  const { t } = useLocale();
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.median), 1);
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {t("trends")}
      </p>
      <div className="mt-2 flex h-16 items-end gap-0.5">
        {points.map((p) => (
          <div
            key={p.key}
            className="flex-1 rounded-t bg-teal-600/80"
            style={{ height: `${(p.median / max) * 100}%`, minHeight: "4px" }}
            title={`${p.label}: ${formatInrShort(p.median)} (${p.count})`}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        By submission month (created_at) in current radius
      </p>
    </div>
  );
}
