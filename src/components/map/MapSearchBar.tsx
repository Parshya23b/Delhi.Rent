"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { RentEntry } from "@/types/rent";
import { useCallback, useState } from "react";

type Result = {
  name: string;
  lng: number;
  lat: number;
  kind?: "place" | "rent_pin";
  id?: string;
  entry?: RentEntry;
};

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MapSearchBar({
  onPick,
}: {
  onPick: (r: Result) => void;
}) {
  const { t } = useLocale();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { results?: Result[] };
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="pointer-events-auto relative w-full min-w-0 max-w-full sm:max-w-md lg:max-w-xl">
      <label className="sr-only" htmlFor="map-search">
        {t("searchPlace")}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
          <IconSearch />
        </span>
        <input
          id="map-search"
          className="w-full rounded-2xl border border-white/20 bg-white/75 py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-inner outline-none ring-teal-500/15 backdrop-blur-md transition placeholder:text-slate-400 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/25 dark:border-white/10 dark:bg-slate-900/65 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          placeholder={t("searchPlace")}
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            void search(v);
          }}
        />
        {loading ? (
          <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-teal-600 dark:text-teal-400">
            …
          </p>
        ) : null}
      </div>
      {results.length > 0 ? (
        <ul className="absolute z-50 mt-2 max-h-52 w-full overflow-y-auto rounded-2xl border border-white/15 bg-white/95 py-1 text-sm shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
          {results.map((r) => (
            <li key={r.id ?? `${r.lng}-${r.lat}-${r.name}-${r.kind ?? "place"}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-slate-800 transition hover:bg-teal-50 dark:text-zinc-100 dark:hover:bg-teal-950/50"
                onClick={() => {
                  onPick(r);
                  setResults([]);
                  setQ("");
                }}
              >
                {r.kind === "rent_pin" ? (
                  <span className="mt-0.5 shrink-0 rounded-md bg-teal-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Rent
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 leading-snug">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
