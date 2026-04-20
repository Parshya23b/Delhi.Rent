/**
 * Server-side memory store for pin confirmations.
 * Used when Supabase is off, or for dummy/local pins that never hit the DB.
 * Also enforces a soft IP-based rate cap to prevent scripted spam.
 */

type EntryRecord = {
  confirmers: Set<string>;
  lastUpdatedAt: number;
};

const byEntry = new Map<string, EntryRecord>();

const ipCounters = new Map<string, { count: number; windowStart: number }>();
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_PER_WINDOW = 30;

function getOrInit(entryId: string): EntryRecord {
  let rec = byEntry.get(entryId);
  if (!rec) {
    rec = { confirmers: new Set<string>(), lastUpdatedAt: 0 };
    byEntry.set(entryId, rec);
  }
  return rec;
}

export function ipAllowed(ipHash: string): boolean {
  const now = Date.now();
  const entry = ipCounters.get(ipHash);
  if (!entry || now - entry.windowStart > IP_WINDOW_MS) {
    ipCounters.set(ipHash, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= IP_MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

export function confirmPinMemory(
  entryId: string,
  confirmerHash: string,
  baselineCount = 0,
): {
  ok: boolean;
  alreadyConfirmed: boolean;
  confirmations_count: number;
  last_updated: string;
} {
  const rec = getOrInit(entryId);
  if (rec.confirmers.has(confirmerHash)) {
    return {
      ok: true,
      alreadyConfirmed: true,
      confirmations_count: baselineCount + rec.confirmers.size,
      last_updated: new Date(rec.lastUpdatedAt || Date.now()).toISOString(),
    };
  }
  rec.confirmers.add(confirmerHash);
  rec.lastUpdatedAt = Date.now();
  return {
    ok: true,
    alreadyConfirmed: false,
    confirmations_count: baselineCount + rec.confirmers.size,
    last_updated: new Date(rec.lastUpdatedAt).toISOString(),
  };
}

/** Augment an entry with in-memory confirmations (used when reading dummy/local pins). */
export function applyMemoryConfirmations<
  T extends {
    id: string;
    confirmations_count?: number;
    last_updated?: string;
  },
>(entry: T): T {
  const rec = byEntry.get(entry.id);
  if (!rec || rec.confirmers.size === 0) return entry;
  const base = entry.confirmations_count ?? 0;
  const lastIso =
    rec.lastUpdatedAt > 0
      ? new Date(rec.lastUpdatedAt).toISOString()
      : (entry.last_updated ?? new Date().toISOString());
  return {
    ...entry,
    confirmations_count: base + rec.confirmers.size,
    last_updated: lastIso,
  };
}

export function hasMemoryConfirmed(entryId: string, confirmerHash: string): boolean {
  return byEntry.get(entryId)?.confirmers.has(confirmerHash) ?? false;
}
