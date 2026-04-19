"use client";

import { STRINGS, type Locale } from "@/i18n/strings";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const LocaleCtx = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof (typeof STRINGS)["en"]) => string;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = useCallback(
    (key: keyof (typeof STRINGS)["en"]) => STRINGS[locale][key] ?? STRINGS.en[key] ?? key,
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: (key: keyof (typeof STRINGS)["en"]) => STRINGS.en[key] ?? key,
    };
  }
  return ctx;
}
