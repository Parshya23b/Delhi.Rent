"use client";

import { AddRentSheet } from "@/components/map/AddRentSheet";
import { SeekerPinSheet } from "@/components/map/SeekerPinSheet";
import { CompareAreasPanel } from "@/components/map/CompareAreasPanel";
import { InsightsPanel } from "@/components/map/InsightsPanel";
import { MapFiltersBar } from "@/components/map/MapFiltersBar";
import { MapSearchBar } from "@/components/map/MapSearchBar";
import { MapSidePanel } from "@/components/map/MapSidePanel";
import {
  MapBottomFindBar,
  MapFloatingStack,
  MapStatusStrip,
} from "@/components/map/MapUiChrome";
import { ClusterFlatsSheet } from "@/components/map/ClusterFlatsSheet";
import { MapView } from "@/components/map/MapView";
import { NearbyRentList } from "@/components/map/NearbyRentList";
import { OverpayBanner } from "@/components/map/OverpayBanner";
import { PinDetailSheet } from "@/components/map/PinDetailSheet";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { computeBuildingClusters } from "@/lib/building-clusters";
import { filterRentEntries } from "@/lib/filter-entries";
import { reverseGeocodeShort } from "@/lib/mapbox-geocode";
import {
  addWatchlistItem,
  getWatchlistSnapshot,
  subscribeWatchlist,
  WATCHLIST_SERVER_SNAPSHOT,
} from "@/lib/watchlist-storage";
import { localityContributionCounts } from "@/lib/locality-leaderboard";
import {
  medianRentByMonth,
  monthPointsFromHistoryRows,
  type MonthPoint,
} from "@/lib/rent-trends";
import { bboxFromCenterZoom } from "@/lib/viewport-bbox";
import {
  computeAreaStats,
  entriesNearPoint,
} from "@/lib/rent-engine";
import { useRentStore } from "@/store/useRentStore";
import type { RentEntry } from "@/types/rent";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import clsx from "clsx";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const CYBER_CITY = { lng: 77.0884, lat: 28.4942 };

function hasPublicMapboxToken(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
}

function IconChevronNav({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg
      className={clsx(className, "transition-transform duration-200", up && "-scale-y-100")}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MapExplorer() {
  const searchParams = useSearchParams();
  const flyToUserOnLoad = searchParams.get("near") === "1";
  const { t, locale, setLocale } = useLocale();

  const latParam = Number(searchParams.get("lat"));
  const lngParam = Number(searchParams.get("lng"));
  const zoomParam = Number(searchParams.get("zoom"));
  const initialView =
    Number.isFinite(latParam) &&
    Number.isFinite(lngParam) &&
    Number.isFinite(zoomParam)
      ? { lat: latParam, lng: lngParam, zoom: zoomParam }
      : undefined;

  const compareBLat = Number(searchParams.get("compareBLat"));
  const compareBLng = Number(searchParams.get("compareBLng"));
  const compareBLabel = searchParams.get("compareBLabel") ?? "Area B";

  const entries = useRentStore((s) => s.entries);
  const mergeEntries = useRentStore((s) => s.mergeEntries);
  const hasContributed = useRentStore((s) => s.hasContributed);
  const showHeatmap = useRentStore((s) => s.showHeatmap);
  const setShowHeatmap = useRentStore((s) => s.setShowHeatmap);
  const mapFilters = useRentStore((s) => s.mapFilters);
  const setMapFilters = useRentStore((s) => s.setMapFilters);
  const layers = useRentStore((s) => s.layers);
  const setLayers = useRentStore((s) => s.setLayers);

  const [viewport, setViewport] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [areaLabel, setAreaLabel] = useState("Delhi NCR");

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<{
    lat: number;
    lng: number;
    areaLabel: string;
  } | null>(null);

  const [pinOpen, setPinOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RentEntry | null>(null);

  const [clusterSheet, setClusterSheet] = useState<{
    entries: RentEntry[];
    lat: number;
    lng: number;
    clusterPointCount: number;
    truncated: boolean;
  } | null>(null);

  const [overpay, setOverpay] = useState<{
    open: boolean;
    userRent: number;
    median: number;
    pct: number;
  }>({ open: false, userRent: 0, median: 0, pct: 0 });

  const [mapError, setMapError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{
    lng: number;
    lat: number;
    zoom?: number;
  } | null>(null);
  const [isochroneGeoJSON, setIsochroneGeoJSON] = useState<FeatureCollection<
    Polygon | MultiPolygon
  > | null>(null);

  const [compareOpen, setCompareOpen] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    () => WATCHLIST_SERVER_SNAPSHOT,
  );

  const [leaderboardRows, setLeaderboardRows] = useState(
    localityContributionCounts([], 20),
  );

  const [insightsExpanded, setInsightsExpanded] = useState(
    () => searchParams.get("insights") === "1",
  );

  const [historyTrends, setHistoryTrends] = useState<MonthPoint[] | null>(null);

  useEffect(() => {
    void fetch("/api/stats/leaderboard")
      .then((r) => r.json())
      .then((d: { leaderboard?: { locality: string; count: number }[] }) => {
        setLeaderboardRows(d.leaderboard ?? []);
      })
      .catch(() => {});
  }, [entries.length]);

  useEffect(() => {
    const bhk = searchParams.get("bhk");
    if (bhk && bhk !== "all") {
      setMapFilters({ bhk });
    }
  }, [searchParams, setMapFilters]);

  useEffect(() => {
    if (heatUrlInit.current) return;
    heatUrlInit.current = true;
    if (searchParams.get("heat") === "1") {
      setShowHeatmap(true);
    }
  }, [searchParams, setShowHeatmap]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/rents");
        const data = await res.json();
        if (!cancelled && data.entries) {
          mergeEntries(data.entries as RentEntry[]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergeEntries]);

  useEffect(() => {
    if (!viewport) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      const b = bboxFromCenterZoom(viewport.lat, viewport.lng, viewport.zoom);
      const q = new URLSearchParams({
        minLat: String(b.minLat),
        maxLat: String(b.maxLat),
        minLng: String(b.minLng),
        maxLng: String(b.maxLng),
      });
      void fetch(`/api/rents?${q}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: { entries?: RentEntry[] }) => {
          if (cancelled || !data.entries) return;
          mergeEntries(data.entries as RentEntry[]);
        })
        .catch(() => {});
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
      ctrl.abort();
    };
  }, [viewport, mergeEntries]);

  useEffect(() => {
    if (typeof window === "undefined" || !viewport) return;
    const id = window.setTimeout(() => {
      const u = new URL(window.location.href);
      u.searchParams.set("lat", viewport.lat.toFixed(5));
      u.searchParams.set("lng", viewport.lng.toFixed(5));
      u.searchParams.set("zoom", String(Math.round(viewport.zoom * 100) / 100));
      if (mapFilters.bhk !== "all") {
        u.searchParams.set("bhk", mapFilters.bhk);
      } else {
        u.searchParams.delete("bhk");
      }
      if (showHeatmap) u.searchParams.set("heat", "1");
      else u.searchParams.delete("heat");
      if (insightsExpanded) u.searchParams.set("insights", "1");
      else u.searchParams.delete("insights");
      const next = `${u.pathname}${u.search}`;
      const cur = `${window.location.pathname}${window.location.search}`;
      if (next !== cur) window.history.replaceState(null, "", next);
    }, 480);
    return () => clearTimeout(id);
  }, [viewport, mapFilters.bhk, showHeatmap, insightsExpanded]);

  const filteredEntries = useMemo(
    () => filterRentEntries(entries, mapFilters),
    [entries, mapFilters],
  );

  const totalRentPinned = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + e.rent_inr, 0),
    [filteredEntries],
  );

  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const heatUrlInit = useRef(false);
  const [mapHeaderExpanded, setMapHeaderExpanded] = useState(true);
  const headerRef = useRef<HTMLElement | null>(null);

  const toggleMapHeader = useCallback(() => {
    setMapHeaderExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!mapHeaderExpanded) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node | null;
      if (!target || !headerRef.current) return;
      if (headerRef.current.contains(target)) return;
      setMapHeaderExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mapHeaderExpanded]);

  useEffect(() => {
    if (!mapHeaderExpanded) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMapHeaderExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mapHeaderExpanded]);

  const vpLat = viewport?.lat;
  const vpLng = viewport?.lng;

  const focusForInsights = useMemo(
    () =>
      vpLat != null && vpLng != null ? { lat: vpLat, lng: vpLng } : null,
    [vpLat, vpLng],
  );

  useEffect(() => {
    if (vpLat == null || vpLng == null) return;
    const timer = setTimeout(() => {
      void reverseGeocodeShort(vpLat, vpLng).then(setAreaLabel);
    }, 350);
    return () => clearTimeout(timer);
  }, [vpLat, vpLng]);

  const insightSlice = useMemo(() => {
    if (!focusForInsights) return [];
    return entriesNearPoint(
      focusForInsights.lat,
      focusForInsights.lng,
      filteredEntries,
      2.5,
    );
  }, [focusForInsights, filteredEntries]);

  useEffect(() => {
    if (!viewport) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const months = 24;
    const b = bboxFromCenterZoom(viewport.lat, viewport.lng, viewport.zoom);
    const q = new URLSearchParams({
      minLat: String(b.minLat),
      maxLat: String(b.maxLat),
      minLng: String(b.minLng),
      maxLng: String(b.maxLng),
      months: String(months),
    });
    if (mapFilters.bhk !== "all") q.set("bhk", mapFilters.bhk);
    const t = window.setTimeout(() => {
      void fetch(`/api/stats/rent-history?${q}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(
          (d: {
            series?: { month_key: string; median_rent: number; pin_count: number }[];
          }) => {
            if (cancelled) return;
            const raw = d.series ?? [];
            if (!raw.length) {
              setHistoryTrends(null);
              return;
            }
            setHistoryTrends(monthPointsFromHistoryRows(raw, months));
          },
        )
        .catch(() => {
          if (!cancelled) setHistoryTrends(null);
        });
    }, 450);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [viewport, mapFilters.bhk, entries.length]);

  const trendsPoints = useMemo(() => {
    if (viewport && historyTrends?.length) return historyTrends;
    return medianRentByMonth(insightSlice, 12);
  }, [viewport, historyTrends, insightSlice]);

  const buildingClusters = useMemo(
    () => computeBuildingClusters(insightSlice),
    [insightSlice],
  );

  const insightStats = useMemo(() => {
    if (insightSlice.length === 0) return null;
    return computeAreaStats(insightSlice, areaLabel);
  }, [insightSlice, areaLabel]);

  const entryById = useMemo(
    () => new Map(filteredEntries.map((e) => [e.id, e] as const)),
    [filteredEntries],
  );

  const openLiveStatsDock = useCallback(() => {
    setInsightsExpanded(true);
    setMapHeaderExpanded(false);
    requestAnimationFrame(() => {
      document
        .getElementById("map-insights-dock")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const onMapClickEmpty = useCallback((lat: number, lng: number) => {
    setSelectedEntry(null);
    setPinOpen(false);
    setAddDraft({ lat, lng, areaLabel: "" });
    void reverseGeocodeShort(lat, lng).then((label) => {
      setAddDraft((d) => (d ? { ...d, areaLabel: label } : d));
    });
    setAddOpen(true);
  }, []);

  const onSelectEntry = useCallback((e: RentEntry) => {
    setAddOpen(false);
    setSelectedEntry(e);
    setPinOpen(true);
  }, []);

  const onClusterSelect = useCallback(
    (payload: {
      entries: RentEntry[];
      lat: number;
      lng: number;
      clusterPointCount: number;
      truncated: boolean;
    }) => {
      setAddOpen(false);
      setAddDraft(null);
      setPinOpen(false);
      setSelectedEntry(null);
      setClusterSheet(payload);
    },
    [],
  );

  const onSubmitted = useCallback(
    (_entry: RentEntry, o: { pct: number; median: number }) => {
      // Match filters to this listing so the new pill marker is not hidden (BHK/rent/women-only, etc.).
      setMapFilters({
        bhk: _entry.bhk,
        furnishing: _entry.furnishing ?? "all",
        rentMin: null,
        rentMax: null,
        last12MonthsOnly: false,
        womenOnly: Boolean(_entry.women_only),
      });
      setFlyTo({
        lng: _entry.lng,
        lat: _entry.lat,
        zoom: 15,
      });
      setSelectedEntry(_entry);
      setPinOpen(true);
      setOverpay({
        open: true,
        userRent: _entry.rent_inr,
        median: o.median,
        pct: o.pct,
      });
      window.setTimeout(() => {
        openLiveStatsDock();
      }, 400);
    },
    [setMapFilters, openLiveStatsDock],
  );

  const openAddFromCenter = () => {
    const lat = viewport?.lat ?? 28.55;
    const lng = viewport?.lng ?? 77.2;
    setAddDraft({
      lat,
      lng,
      areaLabel,
    });
    setAddOpen(true);
  };

  const [seekerOpen, setSeekerOpen] = useState(false);
  const [seekerDraft, setSeekerDraft] = useState<{
    lat: number;
    lng: number;
    areaLabel: string;
  } | null>(null);

  const openSeekerFromCenter = useCallback(() => {
    const lat = viewport?.lat ?? 28.55;
    const lng = viewport?.lng ?? 77.2;
    setAddOpen(false);
    setPinOpen(false);
    setSeekerDraft({ lat, lng, areaLabel });
    setSeekerOpen(true);
  }, [viewport?.lat, viewport?.lng, areaLabel]);

  const handleCyberIso = async () => {
    if (isochroneGeoJSON) {
      setIsochroneGeoJSON(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/isochrone?lng=${CYBER_CITY.lng}&lat=${CYBER_CITY.lat}&minutes=30`,
      );
      if (!res.ok) return;
      const fc = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;
      setIsochroneGeoJSON(fc);
    } catch {
      /* ignore */
    }
  };

  const compareBPoint = useMemo(() => {
    if (Number.isFinite(compareBLat) && Number.isFinite(compareBLng)) {
      return {
        lat: compareBLat,
        lng: compareBLng,
        label: compareBLabel,
      };
    }
    if (watchlist[0]) {
      return {
        lat: watchlist[0].lat,
        lng: watchlist[0].lng,
        label: watchlist[0].label,
      };
    }
    return { lat: 28.6139, lng: 77.209, label: "Connaught Place" };
  }, [compareBLat, compareBLng, compareBLabel, watchlist]);

  const centerForList = viewport?.lat ?? initialView?.lat ?? 28.55;
  const centerLngForList = viewport?.lng ?? initialView?.lng ?? 77.2;

  const showListFallback =
    Boolean(mapError) || !hasPublicMapboxToken();

  const shareBhkLabel =
    mapFilters.bhk === "all" ? "Homes" : mapFilters.bhk;

  const copyMapLink = useCallback(() => {
    if (!viewport || typeof window === "undefined") return;
    const u = new URL(`${window.location.origin}/map`);
    u.searchParams.set("lat", String(viewport.lat));
    u.searchParams.set("lng", String(viewport.lng));
    u.searchParams.set("zoom", String(Math.round(viewport.zoom * 100) / 100));
    if (mapFilters.bhk !== "all") u.searchParams.set("bhk", mapFilters.bhk);
    if (showHeatmap) u.searchParams.set("heat", "1");
    if (insightsExpanded) u.searchParams.set("insights", "1");
    void navigator.clipboard.writeText(u.toString());
  }, [viewport, mapFilters.bhk, showHeatmap, insightsExpanded]);

  return (
    <div className="relative h-dvh w-full min-h-[100svh] overflow-hidden bg-black">
      {!showListFallback ? (
        <>
          <div className="absolute inset-0 z-0 min-h-0">
            <MapView
              entries={filteredEntries}
              entryById={entryById}
              onMapClickEmpty={onMapClickEmpty}
              onSelectEntry={onSelectEntry}
              onClusterSelect={onClusterSelect}
              onViewportChange={setViewport}
              flyToUserOnLoad={flyToUserOnLoad && !initialView}
              initialView={initialView}
              flyTo={flyTo}
              onMapError={(msg) => setMapError(msg)}
              isochroneGeoJSON={isochroneGeoJSON}
              onMapReady={(m) => {
                mapInstanceRef.current = m;
              }}
            />
          </div>
          <MapFloatingStack
            heatmapOn={showHeatmap}
            onGreenCover={() => setShowHeatmap(!showHeatmap)}
            onFlatHunt={() => {
              document.getElementById("map-search")?.focus();
            }}
            metroOn={layers.metro}
            onMetro={() => setLayers({ metro: !layers.metro })}
            onAreaStats={openLiveStatsDock}
            onLocate={() => {
              if (typeof navigator === "undefined" || !navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  mapInstanceRef.current?.flyTo({
                    center: [pos.coords.longitude, pos.coords.latitude],
                    zoom: 14,
                    essential: true,
                  });
                },
                () => {},
                { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
              );
            }}
          />
          <MapBottomFindBar
            onPrimary={openAddFromCenter}
            onSeeker={openSeekerFromCenter}
            primaryLabel={t("ctaAddRent")}
            primaryHint={t("ctaAddRentHint")}
            seekerLabel={t("ctaSeeker")}
            seekerHint={t("ctaSeekerHint")}
            dockTitle={t("bottomDockTitle")}
            sectionAddRentTitle={t("bottomDockAddRentSection")}
            sectionSeekerTitle={t("bottomDockSeekerSection")}
            expandDockAria={t("bottomDockExpandAria")}
            collapseDockAria={t("bottomDockCollapseAria")}
            howToLabel={t("howToUse")}
            onHowTo={() => setHowToOpen(true)}
            builtBy="delhi.rent"
          />
        </>
      ) : (
        <div className="flex h-full flex-col overflow-y-auto p-4 pt-14 sm:p-6">
          <NearbyRentList
            centerLat={centerForList}
            centerLng={centerLngForList}
            entries={filteredEntries}
            title={t("listFallbackTitle")}
          />
        </div>
      )}

      <MapSidePanel
        open={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        watchlist={watchlist}
        onUseWatchlist={(w) => {
          setFlyTo({ lng: w.lng, lat: w.lat, zoom: 13 });
        }}
        onSaveCenter={() => {
          if (!viewport) return;
          addWatchlistItem({
            label: areaLabel,
            lat: viewport.lat,
            lng: viewport.lng,
            cachedMedian: insightStats?.median,
            cachedCount: insightStats?.count,
          });
        }}
        onCompare={() => setCompareOpen(true)}
        onCopyLink={copyMapLink}
        onCyberIsochrone={handleCyberIso}
        isochroneActive={Boolean(isochroneGeoJSON)}
        canSaveCenter={Boolean(viewport)}
      />

      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4"
      >
        <div className="pointer-events-auto flex flex-col gap-2.5 rounded-2xl border border-white/15 bg-slate-900/65 p-2.5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-3 dark:bg-[#0a0f18]/75">
          <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidePanelOpen(true)}
              className="flex h-11 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-[0.98]"
              aria-expanded={sidePanelOpen}
              aria-controls="map-side-panel"
              title={t("mapAndSaved")}
            >
              <span className="sr-only">{t("mapAndSavedShort")}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <Link
              href="/"
              className="hidden shrink-0 flex-col sm:flex"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-400">
                {t("brand")}
              </span>
              <span className="hidden max-w-[140px] truncate text-[10px] leading-tight text-zinc-400 md:block">
                {t("tagline")}
              </span>
            </Link>

            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <MapSearchBar
                onPick={(r) => {
                  setFlyTo({
                    lng: r.lng,
                    lat: r.lat,
                    zoom: r.kind === "rent_pin" ? 15 : 13.5,
                  });
                  if (r.kind === "rent_pin" && (r.entry ?? r.id)) {
                    const hit =
                      r.entry ??
                      useRentStore.getState().entries.find((e) => e.id === r.id);
                    if (hit) {
                      if (r.entry) mergeEntries([r.entry]);
                      setAddOpen(false);
                      setSelectedEntry(hit);
                      setPinOpen(true);
                    }
                  }
                }}
              />
            </div>

            <button
              type="button"
              onClick={toggleMapHeader}
              aria-expanded={mapHeaderExpanded}
              aria-controls="map-header-collapsible"
              title={mapHeaderExpanded ? t("mapHeaderCollapse") : t("mapHeaderExpand")}
              className="flex h-11 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-xl border border-white/15 bg-white/10 text-zinc-200 transition hover:bg-white/15 active:scale-[0.98]"
            >
              <span className="sr-only">
                {mapHeaderExpanded ? t("mapHeaderCollapse") : t("mapHeaderExpand")}
              </span>
              <IconChevronNav up={mapHeaderExpanded} className="text-teal-300" />
            </button>

            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                <button
                  type="button"
                  className={`touch-manipulation rounded-md px-2 py-1.5 text-[11px] font-semibold sm:py-1 ${locale === "en" ? "bg-teal-600/40 text-white" : "text-zinc-400 hover:text-white"}`}
                  onClick={() => setLocale("en")}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={`touch-manipulation rounded-md px-2 py-1.5 text-[11px] font-semibold sm:py-1 ${locale === "hi" ? "bg-teal-600/40 text-white" : "text-zinc-400 hover:text-white"}`}
                  onClick={() => setLocale("hi")}
                >
                  हि
                </button>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div
            id="map-header-collapsible"
            className={mapHeaderExpanded ? "flex flex-col gap-2.5" : "hidden"}
          >
            <div className="flex items-center justify-between gap-2 sm:hidden">
              <Link href="/" className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-400">
                  {t("brand")}
                </span>
                <span className="truncate text-[10px] text-zinc-400">
                  {t("tagline")}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                  <button
                    type="button"
                    className={`touch-manipulation rounded-md px-2 py-1 text-[11px] font-semibold ${locale === "en" ? "bg-teal-600/40 text-white" : "text-zinc-400 hover:text-white"}`}
                    onClick={() => setLocale("en")}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={`touch-manipulation rounded-md px-2 py-1 text-[11px] font-semibold ${locale === "hi" ? "bg-teal-600/40 text-white" : "text-zinc-400 hover:text-white"}`}
                    onClick={() => setLocale("hi")}
                  >
                    हि
                  </button>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <MapStatusStrip
              entryCount={filteredEntries.length}
              totalRentInr={totalRentPinned}
              onLiveStats={openLiveStatsDock}
            />

            <div className="-mx-0.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <MapFiltersBar value={mapFilters} onChange={setMapFilters} />
            </div>
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:justify-end sm:px-4">
        <InsightsPanel
          areaLabel={areaLabel}
          slice={insightSlice}
          liveSnapshot={{
            pinsLoaded: entries.length,
            pinsOnMapFiltered: filteredEntries.length,
            pinsNearCenter: insightSlice.length,
            totalRentInrFiltered: totalRentPinned,
            mapFilters,
            showHeatmap,
            layers,
          }}
          share={
            hasContributed && insightStats
              ? {
                  bhk: shareBhkLabel,
                  area: areaLabel,
                  avg: insightStats.average,
                  min: insightStats.min,
                  max: insightStats.max,
                }
              : null
          }
          trendsPoints={trendsPoints}
          leaderboardRows={leaderboardRows}
          buildingClusters={buildingClusters}
          expanded={insightsExpanded}
          onExpandedChange={setInsightsExpanded}
        />
      </div>

      {howToOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-to-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121214] p-5 text-zinc-100 shadow-2xl">
            <h2 id="how-to-title" className="text-lg font-semibold text-white">
              How to use
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-300">
              <li>Tap the map to drop an anonymous rent pin.</li>
              <li>Use search to jump to a place or find pins by area name.</li>
              <li>Pill markers show clusters — tap to list every pin there (and zoom in).</li>
              <li>Orange pins with “ROOM AVAIL” highlight women-only listings.</li>
            </ul>
            <button
              type="button"
              onClick={() => setHowToOpen(false)}
              className="mt-5 w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <AddRentSheet
        key={addDraft ? `${addDraft.lat}-${addDraft.lng}` : "closed"}
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddDraft(null);
        }}
        draft={addDraft}
        allEntries={entries}
        onSubmitted={onSubmitted}
      />

      <SeekerPinSheet
        key={seekerDraft ? `seek-${seekerDraft.lat}-${seekerDraft.lng}` : "seek-closed"}
        open={seekerOpen}
        onClose={() => {
          setSeekerOpen(false);
          setSeekerDraft(null);
        }}
        draft={seekerDraft}
      />

      <PinDetailSheet
        open={pinOpen}
        onClose={() => {
          setPinOpen(false);
          setSelectedEntry(null);
        }}
        entry={selectedEntry}
        allEntries={entries}
      />

      <ClusterFlatsSheet
        open={Boolean(clusterSheet)}
        onClose={() => setClusterSheet(null)}
        entries={clusterSheet?.entries ?? []}
        centerLat={clusterSheet?.lat ?? 28.55}
        centerLng={clusterSheet?.lng ?? 77.2}
        clusterPointCount={clusterSheet?.clusterPointCount ?? 0}
        truncated={clusterSheet?.truncated ?? false}
        onPickEntry={(e) => {
          setClusterSheet(null);
          onSelectEntry(e);
        }}
      />

      <OverpayBanner
        open={overpay.open}
        onDismiss={() => setOverpay((s) => ({ ...s, open: false }))}
        userRent={overpay.userRent}
        median={overpay.median}
        pct={overpay.pct}
      />

      <CompareAreasPanel
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        entries={filteredEntries}
        areaALabel={areaLabel}
        centerA={{
          lat: viewport?.lat ?? 28.55,
          lng: viewport?.lng ?? 77.2,
        }}
        areaBLabel={compareBPoint.label}
        centerB={{ lat: compareBPoint.lat, lng: compareBPoint.lng }}
      />
    </div>
  );
}
