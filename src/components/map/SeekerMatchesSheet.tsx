"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatInrShort } from "@/lib/format";
import type { SeekerRentMatch } from "@/lib/match-seeker";

export function SeekerMatchesSheet({
  open,
  onClose,
  matches,
  onPickEntry,
}: {
  open: boolean;
  onClose: () => void;
  matches: SeekerRentMatch[];
  onPickEntry: (e: SeekerRentMatch) => void;
}) {
  const { t } = useLocale();
  const title = t("seekerMatchesTitle").replace("{count}", String(matches.length));

  return (
    <BottomSheet open={open} onClose={onClose} title={title} variant="mapPlace" tall>
      <p className="text-xs text-zinc-400">{t("seekerMatchesHint")}</p>
      {matches.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{t("seekerMatchesEmpty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/10">
          {matches.map((m) => (
            <li key={m.entry.id} className="py-2">
              <button
                type="button"
                onClick={() => onPickEntry(m)}
                className="flex w-full touch-manipulation items-start justify-between gap-3 rounded-xl px-1 py-1 text-left text-sm text-zinc-100 transition hover:bg-white/5 active:bg-white/10"
              >
                <span>
                  <span className="font-semibold text-sky-200/95">
                    {formatInrShort(m.entry.rent_inr)} · {m.entry.bhk}
                  </span>
                  {m.entry.area_label ? (
                    <span className="mt-0.5 block text-xs text-zinc-400">{m.entry.area_label}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {m.distance_km.toFixed(1)} {t("kmShort")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
