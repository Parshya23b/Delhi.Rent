import type { PinRow } from "./types.ts";
import { log } from "./logger.ts";

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function contactBlock(p: PinRow): string {
  const lines: string[] = [];
  if (p.email) lines.push(`Email: ${p.email}`);
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  return lines.length ? lines.join("\n") : "No contact on file.";
}

function pinSummary(p: PinRow, label: string): string {
  const desc = (p.description ?? "").trim().slice(0, 400);
  return [
    `${label}`,
    `Type: ${p.type}`,
    `Rent (INR): ${p.rent}`,
    `BHK: ${p.bhk}`,
    `Location: ${mapsUrl(p.lat, p.lng)}`,
    `Description: ${desc || "—"}`,
    contactBlock(p),
  ].join("\n");
}

async function sendResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function sendSendGrid(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to }] }],
      from: { email: opts.from },
      subject: opts.subject,
      content: [{ type: "text/plain", value: opts.text }],
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function dispatchEmail(from: string, to: string, subject: string, text: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY") ?? "";

  if (resendKey) {
    const r = await sendResend({ apiKey: resendKey, from, to, subject, text });
    if (r.ok) return true;
    log.warn("dispatchEmail", "resend_failed", { status: r.status, body: r.body.slice(0, 500) });
  }

  if (sendgridKey) {
    const r = await sendSendGrid({ apiKey: sendgridKey, from, to, subject, text });
    if (r.ok) return true;
    log.warn("dispatchEmail", "sendgrid_failed", { status: r.status, body: r.body.slice(0, 500) });
  }

  log.error("dispatchEmail", "no_provider_succeeded", { to });
  return false;
}

/**
 * Sends one email to `pinA` describing `pinB` (contact + listing summary).
 */
export async function sendMatchEmail(pinA: PinRow, pinB: PinRow): Promise<boolean> {
  const from = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
  if (!pinA.email) {
    log.info("sendMatchEmail", "skip_no_recipient_email", { pinA: pinA.id });
    return false;
  }

  const subject = `New rental match near you (${pinB.type})`;
  const text = [
    "You have a new geo match on the rental map.",
    "",
    pinSummary(pinB, "Matched pin"),
    "",
    "---",
    "Your pin (for reference):",
    pinSummary(pinA, "Your pin"),
  ].join("\n");

  return await dispatchEmail(from, pinA.email, subject, text);
}

/**
 * Notifies both parties when possible (email only).
 */
export async function notifyMatchPair(pinA: PinRow, pinB: PinRow): Promise<{ aOk: boolean; bOk: boolean }> {
  const [aOk, bOk] = await Promise.all([
    sendMatchEmail(pinA, pinB),
    sendMatchEmail(pinB, pinA),
  ]);
  return { aOk, bOk };
}
