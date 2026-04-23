/**
 * Verify request_contact RPC: exists, SECURITY DEFINER, grants, unique index.
 *
 * DATABASE_URL or DIRECT_URL; optional load from .env.local (same as other scripts).
 *
 *   node scripts/verify-request-contact.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?(DATABASE_URL|DIRECT_URL)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
if (!url) {
  console.log(
    "SKIP: set DATABASE_URL or DIRECT_URL.\n" +
      "Optional: add DATABASE_URL to .env.local for this script.",
  );
  process.exit(0);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const errors = [];

try {
  await client.connect();

  const def = await client.query(
    `select p.oid::regprocedure as sig, p.prosecdef as security_definer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'request_contact'`,
  );
  if (def.rowCount !== 1) {
    errors.push("Function public.request_contact(uuid, uuid) not found. Apply 015_request_contact_rpc.sql.");
  } else {
    const row = def.rows[0];
    if (!row.security_definer) {
      errors.push("request_contact should be SECURITY DEFINER.");
    }
    console.log("OK function:", String(row.sig), "| security_definer:", row.security_definer);
  }

  const grants = await client.query(
    `select grantee, privilege_type
     from information_schema.routine_privileges
     where routine_schema = 'public' and routine_name = 'request_contact'
     order by grantee`,
  );
  const grantees = new Set(grants.rows.map((r) => r.grantee));
  for (const need of ["authenticated", "service_role"]) {
    if (!grantees.has(need)) {
      errors.push(`Missing EXECUTE for role: ${need}`);
    }
  }
  if (!errors.length) {
    console.log(
      "OK grants:",
      grants.rows.map((r) => `${r.grantee}:${r.privilege_type}`).join(", "),
    );
  }

  const idx = await client.query(
    `select indexname
     from pg_indexes
     where schemaname = 'public'
       and tablename = 'contact_requests'
       and indexname = 'contact_requests_seeker_responder_uidx'`,
  );
  if (idx.rowCount !== 1) {
    errors.push("Unique index contact_requests_seeker_responder_uidx not found.");
  } else {
    console.log("OK unique index: contact_requests_seeker_responder_uidx");
  }

  const rettype = await client.query(
    `select pg_catalog.format_type(p.prorettype, null) as return_type
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'request_contact'`,
  );
  if (rettype.rowCount === 1) {
    const rt = rettype.rows[0].return_type;
    if (!String(rt).includes("seeker_contact_request_status")) {
      errors.push(`Expected return type seeker_contact_request_status; got ${rt}`);
    } else {
      console.log("OK return type:", rt);
    }
  }
} catch (e) {
  errors.push(e?.message ?? String(e));
} finally {
  await client.end().catch(() => {});
}

if (errors.length) {
  console.error("VERIFY FAILED:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log("All automated checks passed.");
