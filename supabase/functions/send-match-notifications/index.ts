/**
 * Edge: process matches with notified = false (mock email + mark sent).
 * Schedule via Supabase Dashboard → Edge Functions → Cron, or invoke manually.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: CRON_SECRET (header x-cron-secret) same as other jobs in this repo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type MatchRow = {
  id: string;
  pin_a: string;
  pin_b: string;
  match_score: number;
};

type PinRow = {
  id: string;
  type: string;
  contact_email: string | null;
  contact_phone: string | null;
  rent: number;
  bhk: number;
};

async function mockSendEmail(to: string | null, subject: string, body: string): Promise<void> {
  if (!to) return;
  // Replace with Resend/SendGrid in production.
  console.log(
    JSON.stringify({
      event: "mock_email",
      to,
      subject,
      body_preview: body.slice(0, 200),
    }),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await admin
    .from("matches")
    .select("id, pin_a, pin_b, match_score")
    .eq("notified", false)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const processed: string[] = [];

  for (const m of (rows ?? []) as MatchRow[]) {
    const { data: pins } = await admin
      .from("pins")
      .select("id, type, contact_email, contact_phone, rent, bhk")
      .in("id", [m.pin_a, m.pin_b]);

    const list = (pins ?? []) as PinRow[];
    const owner = list.find((p) => p.type === "owner");
    const seeker = list.find((p) => p.type === "seeker");

    const subject = `Rent match (score ${m.match_score.toFixed(2)})`;
    const body = `You have a new geo match between owner pin ${m.pin_a} and seeker pin ${m.pin_b}.`;

    await mockSendEmail(owner?.contact_email ?? null, subject, body);
    await mockSendEmail(seeker?.contact_email ?? null, subject, body);

    const { error: upErr } = await admin.from("matches").update({ notified: true }).eq("id", m.id);
    if (!upErr) processed.push(m.id);
  }

  return new Response(JSON.stringify({ ok: true, notified_match_ids: processed }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
