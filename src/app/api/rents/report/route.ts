import { NextResponse } from "next/server";
import { hashDeviceId } from "@/lib/device-hash";
import {
  applyReportOnLocalEntry,
  banDeviceMemory,
} from "@/lib/moderation-memory";
import { REPORTS_TO_REVOKE_POSTING } from "@/lib/rent-policy";
import { getSupabaseService } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const reporterRaw = req.headers.get("x-device-id") ?? "anon";
  const reporterHash = hashDeviceId(reporterRaw);

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { id: entryId } = body;

  if (entryId.startsWith("dummy-")) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: "Demo pins cannot be reported.",
    });
  }

  const supabase = getSupabaseService();

  if (!supabase) {
    const local = applyReportOnLocalEntry(entryId, reporterHash);
    if (!local.ok) {
      return NextResponse.json(
        { error: local.reason ?? "Could not report" },
        { status: local.reason === "Cannot report your own pin" ? 400 : 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      authorBanned: local.bannedAuthor,
    });
  }

  const { data: entry, error: fetchErr } = await supabase
    .from("rent_entries")
    .select("id, device_id_hash")
    .eq("id", entryId)
    .maybeSingle();

  if (fetchErr || !entry) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  const authorHash = String(entry.device_id_hash ?? "");
  if (!authorHash) {
    return NextResponse.json({ error: "Cannot report legacy pin" }, { status: 400 });
  }
  if (authorHash === reporterHash) {
    return NextResponse.json(
      { error: "Cannot report your own pin" },
      { status: 400 },
    );
  }

  const { error: insErr } = await supabase.from("rent_reports").insert({
    entry_id: entryId,
    reporter_device_hash: reporterHash,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({
        ok: true,
        alreadyReported: true,
      });
    }
    console.error(insErr);
    return NextResponse.json({ error: "Could not save report" }, { status: 500 });
  }

  const { data: authorEntries } = await supabase
    .from("rent_entries")
    .select("id")
    .eq("device_id_hash", authorHash);

  const ids = (authorEntries ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { count, error: countErr } = await supabase
    .from("rent_reports")
    .select("*", { count: "exact", head: true })
    .in("entry_id", ids);

  if (countErr) {
    console.error(countErr);
    return NextResponse.json({ ok: true });
  }

  const total = count ?? 0;
  let authorBanned = false;
  if (total >= REPORTS_TO_REVOKE_POSTING) {
    const { error: banErr } = await supabase.from("banned_posting_devices").upsert(
      {
        device_id_hash: authorHash,
        reason: `Auto: ${total} reports on submissions`,
      },
      { onConflict: "device_id_hash" },
    );
    if (!banErr) {
      authorBanned = true;
      banDeviceMemory(authorHash);
    }
  }

  return NextResponse.json({ ok: true, authorBanned });
}
