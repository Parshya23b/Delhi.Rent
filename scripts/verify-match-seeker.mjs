/**
 * Verify match_seeker RPC exists, is SECURITY DEFINER, and has expected grants.
 *
 * Uses DATABASE_URL or DIRECT_URL (same as apply-sql-file.mjs).
 * Optionally loads those keys from .env.local if not set.
 *
 *   node scripts/verify-match-seeker.mjs
 *
 * Does not call match_seeker() (needs JWT / real seeker row); use Supabase
 * client with a logged-in user for an end-to-end run.
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
    "SKIP: set DATABASE_URL or DIRECT_URL (Supabase → Settings → Database → URI, direct).\n" +
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
     where n.nspname = 'public' and p.proname = 'match_seeker'`,
  );
  if (def.rowCount !== 1) {
    errors.push('Function public.match_seeker(uuid) not found. Apply 014_match_seeker_rpc.sql first.');
  } else {
    const row = def.rows[0];
    if (!row.security_definer) {
      errors.push("match_seeker should be SECURITY DEFINER (got prosecdef = false).");
    }
    console.log("OK function:", String(row.sig), "| security_definer:", row.security_definer);
  }

  const grants = await client.query(
    `select grantee, privilege_type
     from information_schema.routine_privileges
     where routine_schema = 'public' and routine_name = 'match_seeker'
     order by grantee, privilege_type`,
  );
  const grantees = new Set(grants.rows.map((r) => r.grantee));
  for (const need of ["authenticated", "service_role"]) {
    if (!grantees.has(need)) {
      errors.push(`Missing EXECUTE grant for role: ${need}`);
    }
  }
  if (!errors.length) {
    console.log(
      "OK grants:",
      grants.rows.map((r) => `${r.grantee}:${r.privilege_type}`).join(", "),
    );
  }

  const args = await client.query(
    `select pronargs, proargnames
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'match_seeker'`,
  );
  if (args.rowCount === 1) {
    const { pronargs, proargnames } = args.rows[0];
    const names = proargnames ?? [];
    if (pronargs !== 1) {
      errors.push(`Expected 1 argument; got pronargs=${pronargs}`);
    } else if (names.length && names[0] !== "seeker_id") {
      errors.push(
        `Expected first arg named seeker_id; got proargnames=${JSON.stringify(names)}`,
      );
    } else {
      console.log("OK signature: match_seeker(seeker_id uuid)");
    }
  }

  const deps = await client.query(
    `select to_regclass('public.rent_entries') as rent_entries,
            to_regclass('public.areas') as areas,
            to_regclass('public.seeker_pins') as seeker_pins,
            to_regclass('public.matches') as matches,
            exists(select 1 from pg_extension where extname = 'postgis') as postgis`,
  );
  const d = deps.rows[0];
  for (const [k, v] of Object.entries(d)) {
    if (!v) errors.push(`Missing dependency for match_seeker: ${k}`);
  }
  if (!errors.length) {
    console.log("OK dependencies: rent_entries, areas, seeker_pins, matches, postgis");
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
