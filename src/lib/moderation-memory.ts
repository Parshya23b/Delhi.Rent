import { REPORTS_TO_REVOKE_POSTING } from "@/lib/rent-policy";
import { hashDeviceId } from "@/lib/device-hash";

/** Server-only fallbacks when Supabase is not configured. */
const bannedDevices = new Set<string>();
/** entryId (local-*) -> author device hash */
const localEntryAuthor = new Map<string, string>();
/** author device hash -> report count on their pins */
const reportCountByAuthor = new Map<string, number>();

export function registerLocalEntryAuthor(entryId: string, deviceIdRaw: string): void {
  if (!entryId.startsWith("local-")) return;
  localEntryAuthor.set(entryId, hashDeviceId(deviceIdRaw));
}

export function isBannedMemory(deviceHash: string): boolean {
  return bannedDevices.has(deviceHash);
}

export function banDeviceMemory(deviceHash: string): void {
  bannedDevices.add(deviceHash);
}

/** Returns true if banned after this report. */
export function applyReportOnLocalEntry(
  entryId: string,
  reporterDeviceHash: string,
): { ok: boolean; bannedAuthor: boolean; reason?: string } {
  const author = localEntryAuthor.get(entryId);
  if (!author) {
    return { ok: false, bannedAuthor: false, reason: "Unknown entry" };
  }
  if (author === reporterDeviceHash) {
    return { ok: false, bannedAuthor: false, reason: "Cannot report your own pin" };
  }
  const n = (reportCountByAuthor.get(author) ?? 0) + 1;
  reportCountByAuthor.set(author, n);
  let bannedAuthor = false;
  if (n >= REPORTS_TO_REVOKE_POSTING) {
    bannedDevices.add(author);
    bannedAuthor = true;
  }
  return { ok: true, bannedAuthor };
}
