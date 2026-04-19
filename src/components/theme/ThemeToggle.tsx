"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer theme-dependent UI until after hydration (matches SSR placeholder).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mounted gate for next-themes
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 rounded-lg border border-zinc-200 bg-white/80 dark:border-zinc-600 dark:bg-zinc-800/80"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white/90 text-lg shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/90 dark:hover:bg-zinc-700"
      title={isDark ? "Light mode" : "Dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
