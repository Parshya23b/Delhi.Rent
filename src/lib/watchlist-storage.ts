const KEY = "delhi-rent-watchlist-v1";

export type WatchlistItem = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  cachedMedian?: number;
  cachedCount?: number;
};

/** Stable empty array for SSR + empty watchlist; getSnapshot must reuse references when data is unchanged. */
export const WATCHLIST_SERVER_SNAPSHOT: WatchlistItem[] = [];

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: WatchlistItem[] = WATCHLIST_SERVER_SNAPSHOT;

/** Subscribe to watchlist changes (localStorage updates from this tab). */
export function subscribeWatchlist(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notifyWatchlistChange() {
  listeners.forEach((l) => l());
}

/**
 * Snapshot for useSyncExternalStore (client). Returns the same array reference until localStorage changes.
 */
export function getWatchlistSnapshot(): WatchlistItem[] {
  if (typeof window === "undefined") return WATCHLIST_SERVER_SNAPSHOT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    if (!raw) {
      cachedSnapshot = WATCHLIST_SERVER_SNAPSHOT;
      return cachedSnapshot;
    }
    const p = JSON.parse(raw) as WatchlistItem[];
    cachedSnapshot = Array.isArray(p) ? p.slice(0, 12) : WATCHLIST_SERVER_SNAPSHOT;
    return cachedSnapshot;
  } catch {
    cachedRaw = undefined;
    cachedSnapshot = WATCHLIST_SERVER_SNAPSHOT;
    return cachedSnapshot;
  }
}

export function loadWatchlist(): WatchlistItem[] {
  return getWatchlistSnapshot();
}

export function saveWatchlist(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 12)));
    notifyWatchlistChange();
  } catch {
    /* ignore */
  }
}

export function addWatchlistItem(item: Omit<WatchlistItem, "id"> & { id?: string }): WatchlistItem[] {
  const cur = loadWatchlist();
  const id = item.id ?? `wl-${Date.now()}`;
  const next: WatchlistItem = {
    id,
    label: item.label,
    lat: item.lat,
    lng: item.lng,
    cachedMedian: item.cachedMedian,
    cachedCount: item.cachedCount,
  };
  const filtered = cur.filter((x) => x.id !== id);
  const merged = [next, ...filtered].slice(0, 12);
  saveWatchlist(merged);
  return merged;
}
