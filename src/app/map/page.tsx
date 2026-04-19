import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { MapExplorer } from "@/components/map/MapExplorer";
import { Suspense } from "react";

export default function MapPage() {
  return (
    <LocaleProvider>
      <Suspense
        fallback={<div className="h-dvh animate-pulse bg-zinc-200" aria-hidden />}
      >
        <MapExplorer />
      </Suspense>
    </LocaleProvider>
  );
}
