/**
 * Run a SQL migration file against Postgres (Supabase direct connection).
 *
 *   DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres" \
 *     node scripts/apply-sql-file.mjs supabase/migrations/007_seeker_pins.sql
 *
 * Get the URI from: Supabase Dashboard → Project Settings → Database
 * → Connection string → URI (use "Direct connection", not pooler, for DDL).
 *
 * Requires: npm install (includes devDependency `pg`).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: node scripts/apply-sql-file.mjs <path-to.sql>");
  process.exit(1);
}

const sqlPath = path.isAbsolute(fileArg) ? fileArg : path.join(repoRoot, fileArg);
if (!fs.existsSync(sqlPath)) {
  console.error("File not found:", sqlPath);
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
if (!url) {
  console.error(
    "Missing DATABASE_URL or DIRECT_URL.\n" +
      "Set a Postgres connection URI (Supabase → Settings → Database → Connection string → URI, direct).",
  );
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("OK — applied:", path.relative(repoRoot, sqlPath));
} catch (e) {
  console.error("Migration failed:", e?.message ?? e);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
