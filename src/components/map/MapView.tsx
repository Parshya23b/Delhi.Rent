"use client";

import {
  createClusterMarkerElement,
  createPointMarkerElement,
} from "@/components/map/rentMarkerElements";
import { createSeekerPinMarkerElement } from "@/components/map/seekerMarkerElements";
import { rentsToGeoJSON } from "@/components/map/rentToGeoJSON";
import { buildRentClusterIndex, collectRentEntriesForCluster } from "@/lib/rent-supercluster";
import {
  getSeekerPins,
  type SeekerMapPin,
} from "@/lib/supabase/get-seeker-pins";
import { getRentPins, rentPinToRentEntry, type RentPin } from "@/lib/supabase/get-rent-pins";
import { subscribeRentEntriesRealtime } from "@/lib/supabase/rent-entries-realtime";
import { subscribeSeekerPinsRealtime } from "@/lib/supabase/seeker-pins-realtime";
import { getSupabaseRead } from "@/lib/supabase/service";
import { useRentStore } from "@/store/useRentStore";
import type { RentEntry } from "@/types/rent";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type Supercluster from "supercluster";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CENTER: [number, number] = [77.2, 28.55];
const DEFAULT_ZOOM = 9.2;

function getToken(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

export function MapView({
  entries: _storeEntries,
  entryById: _storeEntryById,
  onMapClickEmpty,
  onSelectEntry,
  onViewportChange,
  flyToUserOnLoad,
  initialView,
  flyTo,
  onMapError,
  isochroneGeoJSON,
  onMapReady,
  onClusterSelect,
  onSelectSeekerPin,
  onMapEntriesChange,
  onSeekerPinsChange,
  /** Bumps to force a full rent + seeker reload from Supabase (e.g. after seeker submit). */
  dbPinsReloadKey = 0,
}: {
  entries: RentEntry[];
  entryById: Map<string, RentEntry>;
  onMapClickEmpty: (lat: number, lng: number) => void;
  onSelectEntry: (e: RentEntry) => void;
  /** Seeker marker tap: same rent pool as map clustering (`getRentPins`). */
  onSelectSeekerPin?: (pin: SeekerMapPin, rentEntries: RentEntry[]) => void;
  /** When set, cluster pill taps resolve leaf pins and call this (still zooms to expand the cluster). */
  onClusterSelect?: (payload: {
    entries: RentEntry[];
    lat: number;
    lng: number;
    clusterPointCount: number;
    truncated: boolean;
  }) => void;
  onViewportChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  flyToUserOnLoad?: boolean;
  initialView?: { lng: number; lat: number; zoom: number };
  flyTo?: { lng: number; lat: number; zoom?: number } | null;
  onMapError?: (message: string) => void;
  isochroneGeoJSON?: FeatureCollection<Polygon | MultiPolygon> | null;
  /** Fired once when the map style and base layers are ready (for locate, fly, etc.). */
  onMapReady?: (map: mapboxgl.Map) => void;
  /** Fired when DB-backed rent pins used on the map change (load + realtime). */
  onMapEntriesChange?: (entries: RentEntry[]) => void;
  /** Fired when seeker pins from DB change (load + realtime). */
  onSeekerPinsChange?: (pins: SeekerMapPin[]) => void;
  dbPinsReloadKey?: number;
}) {
  const [pins, setPins] = useState<RentPin[]>([]);
  const [seekerPins, setSeekerPins] = useState<SeekerMapPin[]>([]);

  /** Full load from Supabase only (no static pins). Re-runs when store/API merges new rents or parent bumps reload key. */
  useEffect(() => {
    const supabase = getSupabaseRead();
    if (!supabase) {
      console.warn(
        "[MapView] DB pin load skipped — no Supabase read client. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    let cancelled = false;
    const loadFromDb = (reason: string) => {
      console.log("[MapView] Loading rent + seeker pins from DB:", reason);
      void Promise.all([getRentPins(supabase), getSeekerPins(supabase)]).then(([rent, seeker]) => {
        if (cancelled) return;
        console.log("[MapView] DB pin load OK:", {
          reason,
          rentPins: rent.length,
          seekerPins: seeker.length,
        });
        setPins(rent);
        setSeekerPins(seeker);
      });
    };

    loadFromDb(
      `bootstrap storeLen=${_storeEntries.length} reloadKey=${dbPinsReloadKey}`,
    );

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      loadFromDb("document-visibility-visible");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [_storeEntries.length, dbPinsReloadKey]);

  useEffect(() => {
    const supabase = getSupabaseRead();
    if (!supabase) {
      console.warn("[MapView] Realtime skipped — no Supabase client");
      return;
    }

    const upsertRent = (pin: RentPin) => {
      console.log("[MapView] rent pin apply (realtime)", { id: pin.id });
      setPins((prev) => {
        const i = prev.findIndex((p) => p.id === pin.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = pin;
          return next;
        }
        return prev.some((p) => p.id === pin.id) ? prev : [...prev, pin];
      });
    };

    const unsubRent = subscribeRentEntriesRealtime(supabase, {
      upsertPin: upsertRent,
      removePin: (id) => {
        console.log("[MapView] rent pin remove (realtime)", { id });
        setPins((prev) => prev.filter((p) => p.id !== id));
      },
      refetchPins: async () => {
        console.log("[MapView] rent pins full refetch (realtime fallback)");
        const next = await getRentPins(supabase);
        setPins(next);
      },
    });

    const unsubSeeker = subscribeSeekerPinsRealtime(supabase, {
      upsertPin: (pin) => {
        console.log("[MapView] seeker pin apply (realtime)", { id: pin.id });
        setSeekerPins((prev) => {
          const i = prev.findIndex((p) => p.id === pin.id);
          if (i >= 0) {
            const next = [...prev];
            next[i] = pin;
            return next;
          }
          return prev.some((p) => p.id === pin.id) ? prev : [...prev, pin];
        });
      },
      removePin: (id) => {
        console.log("[MapView] seeker pin remove (realtime)", { id });
        setSeekerPins((prev) => prev.filter((p) => p.id !== id));
      },
      refetchPins: async () => {
        console.log("[MapView] seeker pins full refetch (realtime fallback)");
        const next = await getSeekerPins(supabase);
        setSeekerPins(next);
      },
    });

    return () => {
      unsubRent();
      unsubSeeker();
    };
  }, []);

  /** Map pins come only from Supabase (`getRentPins`); not from persisted store or mock data. */
  const mapEntries = useMemo(() => pins.map(rentPinToRentEntry), [pins]);

  const entryByIdMerged = useMemo(
    () => new Map(mapEntries.map((e) => [e.id, e] as const)),
    [mapEntries],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialViewRef = useRef(initialView);

  const showHeatmap = useRentStore((s) => s.showHeatmap);
  const hasContributed = useRentStore((s) => s.hasContributed);
  const layers = useRentStore((s) => s.layers);

  const onMapClickEmptyRef = useRef(onMapClickEmpty);
  const onSelectEntryRef = useRef(onSelectEntry);
  const onViewportChangeRef = useRef(onViewportChange);
  const onMapErrorRef = useRef(onMapError);
  const onMapReadyRef = useRef(onMapReady);
  const onClusterSelectRef = useRef(onClusterSelect);
  const onSelectSeekerPinRef = useRef(onSelectSeekerPin);
  const entryByIdRef = useRef(entryByIdMerged);
  const flyToUserRef = useRef(!!flyToUserOnLoad);
  const indexRef = useRef<Supercluster | null>(null);
  const htmlMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const seekerMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const seekerPinsRef = useRef<SeekerMapPin[]>([]);
  const syncHtmlMarkersRef = useRef<(() => void) | null>(null);
  const entriesRef = useRef(mapEntries);
  const onMapEntriesChangeRef = useRef(onMapEntriesChange);
  const onSeekerPinsChangeRef = useRef(onSeekerPinsChange);

  useEffect(() => {
    initialViewRef.current = initialView;
  }, [initialView]);

  useEffect(() => {
    entriesRef.current = mapEntries;
  }, [mapEntries]);

  useEffect(() => {
    onMapEntriesChangeRef.current?.(mapEntries);
  }, [mapEntries]);

  useEffect(() => {
    onSeekerPinsChangeRef.current?.(seekerPins);
  }, [seekerPins]);

  useEffect(() => {
    seekerPinsRef.current = seekerPins;
    syncHtmlMarkersRef.current?.();
  }, [seekerPins]);

  useEffect(() => {
    onMapClickEmptyRef.current = onMapClickEmpty;
    onSelectEntryRef.current = onSelectEntry;
    onViewportChangeRef.current = onViewportChange;
    onMapErrorRef.current = onMapError;
    onMapReadyRef.current = onMapReady;
    onClusterSelectRef.current = onClusterSelect;
    onSelectSeekerPinRef.current = onSelectSeekerPin;
    onMapEntriesChangeRef.current = onMapEntriesChange;
    onSeekerPinsChangeRef.current = onSeekerPinsChange;
    entryByIdRef.current = entryByIdMerged;
    flyToUserRef.current = !!flyToUserOnLoad;
  }, [
    onMapClickEmpty,
    onSelectEntry,
    onViewportChange,
    onMapError,
    onMapReady,
    onClusterSelect,
    onSelectSeekerPin,
    onMapEntriesChange,
    onSeekerPinsChange,
    entryByIdMerged,
    flyToUserOnLoad,
  ]);

  useEffect(() => {
    indexRef.current = buildRentClusterIndex(mapEntries);
    syncHtmlMarkersRef.current?.();
  }, [mapEntries]);

  const updateData = useCallback(() => {
    const map = mapRef.current;
    if (!map?.getSource("rents")) return;
    const src = map.getSource("rents") as mapboxgl.GeoJSONSource;
    src.setData(rentsToGeoJSON(mapEntries));
  }, [mapEntries]);

  useEffect(() => {
    updateData();
  }, [updateData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("rent-heatmap")) return;
    map.setLayoutProperty(
      "rent-heatmap",
      "visibility",
      hasContributed && showHeatmap ? "visible" : "none",
    );
  }, [hasContributed, showHeatmap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    if (map.getLayer("metro-lines"))
      map.setLayoutProperty("metro-lines", "visibility", vis(layers.metro));
    if (map.getLayer("zone-fill"))
      map.setLayoutProperty("zone-fill", "visibility", vis(layers.zones));
    if (map.getLayer("zone-outline"))
      map.setLayoutProperty("zone-outline", "visibility", vis(layers.zones));
    if (map.getLayer("rera-fill"))
      map.setLayoutProperty("rera-fill", "visibility", vis(layers.rera));
    if (map.getLayer("rera-outline"))
      map.setLayoutProperty("rera-outline", "visibility", vis(layers.rera));
    if (map.getLayer("safety-circle"))
      map.setLayoutProperty("safety-circle", "visibility", vis(layers.safety));
    const isoOn = Boolean(isochroneGeoJSON);
    if (map.getLayer("isochrone-fill")) {
      map.setLayoutProperty("isochrone-fill", "visibility", isoOn ? "visible" : "none");
      map.setLayoutProperty("isochrone-outline", "visibility", isoOn ? "visible" : "none");
    }
  }, [layers.metro, layers.zones, layers.rera, layers.safety, isochroneGeoJSON]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("isochrone")) return;
    const src = map.getSource("isochrone") as mapboxgl.GeoJSONSource;
    if (isochroneGeoJSON) {
      src.setData(isochroneGeoJSON);
      if (map.getLayer("isochrone-fill")) {
        map.setLayoutProperty("isochrone-fill", "visibility", "visible");
        map.setLayoutProperty("isochrone-outline", "visibility", "visible");
      }
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
      if (map.getLayer("isochrone-fill")) {
        map.setLayoutProperty("isochrone-fill", "visibility", "none");
        map.setLayoutProperty("isochrone-outline", "visibility", "none");
      }
    }
  }, [isochroneGeoJSON]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 13.5,
      essential: true,
    });
  }, [flyTo]);

  useEffect(() => {
    const token = getToken();
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const iv = initialViewRef.current;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: iv ? [iv.lng, iv.lat] : DEFAULT_CENTER,
      zoom: iv?.zoom ?? DEFAULT_ZOOM,
      attributionControl: true,
      pitch: 0,
    });
    mapRef.current = map;
    const htmlMarkers = htmlMarkersRef.current;

    map.on("error", (e) => {
      onMapErrorRef.current?.(e.error?.message ?? "Map error");
    });

    map.on("load", () => {
      const seekerMarkers = seekerMarkersRef.current;

      const syncHtmlMarkers = () => {
        const m = mapRef.current;
        const index = indexRef.current;
        if (!m?.loaded() || !index) return;

        htmlMarkers.forEach((mk) => mk.remove());
        htmlMarkers.clear();
        seekerMarkers.forEach((mk) => mk.remove());
        seekerMarkers.clear();

        const b = m.getBounds();
        if (!b) return;
        const bbox: [number, number, number, number] = [
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth(),
        ];
        const z = Math.floor(m.getZoom());
        const clusters = index.getClusters(bbox, z);

        for (const f of clusters) {
          const geom = f.geometry;
          if (geom?.type !== "Point") continue;
          const [lng, lat] = geom.coordinates;
          const props = f.properties as Record<string, unknown> | null;
          if (!props) continue;

          if (props.cluster) {
            const clusterId = props.cluster_id as number;
            const count = props.point_count as number;
            const key = `c-${clusterId}`;
            const el = createClusterMarkerElement(count, () => {
              const cb = onClusterSelectRef.current;
              if (cb) {
                const { entries: clusterEntries, truncated } = collectRentEntriesForCluster(
                  index,
                  clusterId,
                  count,
                  entryByIdRef.current,
                );
                if (clusterEntries.length) {
                  cb({
                    entries: clusterEntries,
                    lat,
                    lng,
                    clusterPointCount: count,
                    truncated,
                  });
                }
              }
              const exp = index.getClusterExpansionZoom(clusterId);
              m.easeTo({
                center: [lng, lat],
                zoom: Math.min(exp + 0.25, 18),
              });
            });
            const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
              .setLngLat([lng, lat])
              .addTo(m);
            htmlMarkers.set(key, marker);
          } else {
            const id = String(props.id ?? "");
            if (!id) continue;
            const entry = entryByIdRef.current.get(id);
            if (!entry) continue;
            const key = `p-${id}`;
            const el = createPointMarkerElement(entry, () => {
              onSelectEntryRef.current(entry);
            });
            const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
              .setLngLat([lng, lat])
              .addTo(m);
            htmlMarkers.set(key, marker);
          }
        }

        for (const sp of seekerPinsRef.current) {
          if (!b.contains([sp.lng, sp.lat])) continue;
          const key = `s-${sp.id}`;
          const el = createSeekerPinMarkerElement(sp, () => {
            onSelectSeekerPinRef.current?.(sp, entriesRef.current);
          });
          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([sp.lng, sp.lat])
            .addTo(m);
          seekerMarkers.set(key, marker);
        }
      };

      syncHtmlMarkersRef.current = syncHtmlMarkers;

      map.addSource("rents", {
        type: "geojson",
        data: rentsToGeoJSON(entriesRef.current),
        cluster: false,
      });

      map.addSource("isochrone", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "isochrone-fill",
        type: "fill",
        source: "isochrone",
        paint: {
          "fill-color": "#0ea5e9",
          "fill-opacity": 0.12,
        },
        layout: { visibility: "none" },
      });
      map.addLayer({
        id: "isochrone-outline",
        type: "line",
        source: "isochrone",
        paint: {
          "line-color": "#0284c7",
          "line-width": 2,
          "line-opacity": 0.7,
        },
        layout: { visibility: "none" },
      });

      map.addLayer({
        id: "rent-heatmap",
        type: "heatmap",
        source: "rents",
        maxzoom: 15,
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "rent_inr"],
            8000,
            0,
            100000,
            1,
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 2],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.3,
            "rgb(103,169,207)",
            0.6,
            "rgb(209,229,240)",
            0.8,
            "rgb(253,219,199)",
            1,
            "rgb(178,24,43)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 10, 14, 22],
          "heatmap-opacity": 0.65,
        },
        layout: { visibility: "none" },
      });

      indexRef.current = buildRentClusterIndex(entriesRef.current);
      syncHtmlMarkers();
      map.on("moveend", syncHtmlMarkers);
      map.on("zoomend", syncHtmlMarkers);
      onMapReadyRef.current?.(map);

      const addOptional = (url: string, id: "rera" | "safety") => {
        fetch(url)
          .then((r) => r.json())
          .then((data) => {
            if (map.getSource(id)) return;
            map.addSource(id, { type: "geojson", data });
            const visRera = useRentStore.getState().layers.rera;
            const visSafe = useRentStore.getState().layers.safety;
            if (id === "rera") {
              map.addLayer({
                id: "rera-fill",
                type: "fill",
                source: "rera",
                paint: {
                  "fill-color": "#ca8a04",
                  "fill-opacity": 0.08,
                },
                layout: { visibility: visRera ? "visible" : "none" },
              });
              map.addLayer({
                id: "rera-outline",
                type: "line",
                source: "rera",
                paint: {
                  "line-color": "#ca8a04",
                  "line-width": 1,
                  "line-opacity": 0.5,
                },
                layout: { visibility: visRera ? "visible" : "none" },
              });
            }
            if (id === "safety") {
              map.addLayer({
                id: "safety-circle",
                type: "circle",
                source: "safety",
                paint: {
                  "circle-radius": 14,
                  "circle-color": "#a855f7",
                  "circle-opacity": 0.35,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#7c3aed",
                },
                layout: { visibility: visSafe ? "visible" : "none" },
              });
            }
          })
          .catch(() => {});
      };

      fetch("/data/delhi-metro.json")
        .then((r) => r.json())
        .then((data) => {
          if (!map.getSource("metro")) {
            map.addSource("metro", { type: "geojson", data });
            map.addLayer({
              id: "metro-lines",
              type: "line",
              source: "metro",
              paint: {
                "line-color": ["get", "color"],
                "line-width": 3,
                "line-opacity": 0.85,
              },
              layout: { visibility: layers.metro ? "visible" : "none" },
            });
          }
        })
        .catch(() => {});

      fetch("/data/delhi-zones.json")
        .then((r) => r.json())
        .then((data) => {
          if (!map.getSource("zones")) {
            map.addSource("zones", { type: "geojson", data });
            map.addLayer({
              id: "zone-fill",
              type: "fill",
              source: "zones",
              paint: {
                "fill-color": "#6366f1",
                "fill-opacity": 0.06,
              },
              layout: { visibility: layers.zones ? "visible" : "none" },
            });
            map.addLayer({
              id: "zone-outline",
              type: "line",
              source: "zones",
              paint: {
                "line-color": "#6366f1",
                "line-width": 1,
                "line-opacity": 0.35,
              },
              layout: { visibility: layers.zones ? "visible" : "none" },
            });
            map.addLayer({
              id: "zone-labels",
              type: "symbol",
              source: "zones",
              layout: {
                "text-field": ["get", "name"],
                "text-size": 11,
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              },
              paint: {
                "text-color": "#4338ca",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1,
              },
            });
          }
        })
        .catch(() => {});

      addOptional("/data/rera-micro-markets.json", "rera");
      addOptional("/data/safety-perception.json", "safety");

      map.on("click", (e) => {
        if (e.originalEvent.defaultPrevented) return;
        const target = e.originalEvent.target as HTMLElement | null;
        if (target?.closest?.(".mapboxgl-marker")) return;
        onMapClickEmptyRef.current(e.lngLat.lat, e.lngLat.lng);
      });

      const emitViewport = () => {
        const c = map.getCenter();
        const z = map.getZoom();
        onViewportChangeRef.current?.({
          lat: c.lat,
          lng: c.lng,
          zoom: z,
        });
      };
      map.on("moveend", () => {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = setTimeout(emitViewport, 180);
      });
      emitViewport();

      if (flyToUserRef.current && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.flyTo({
              center: [pos.coords.longitude, pos.coords.latitude],
              zoom: 12,
              essential: true,
            });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
        );
      }
    });

    return () => {
      clearTimeout(viewportTimerRef.current);
      htmlMarkers.forEach((mk) => mk.remove());
      htmlMarkers.clear();
      seekerMarkersRef.current.forEach((mk) => mk.remove());
      seekerMarkersRef.current.clear();
      syncHtmlMarkersRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single map init
  }, []);

  const token = getToken();
  if (!token) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-100 p-6 text-center dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Add <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800 dark:text-zinc-200">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800 dark:text-zinc-200">.env.local</code>
        </p>
        <p className="max-w-sm text-xs text-zinc-600 dark:text-zinc-400">
          Get a token from mapbox.com — the map renders here once configured.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full min-h-[320px] bg-black" />
  );
}
