/**
 * Lightweight check that Step 5 API route files exist (no server / DB required).
 *
 *   node scripts/verify-seeker-api.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const required = [
  "src/app/api/seeker/create/route.ts",
  "src/app/api/seeker/match/route.ts",
  "src/app/api/seeker/matches/route.ts",
  "src/app/api/contact/request/route.ts",
  "src/app/api/contact/respond/route.ts",
  "src/controllers/seeker.controller.ts",
  "src/controllers/contact.controller.ts",
  "src/services/seeker.service.ts",
  "src/services/contact.service.ts",
  "src/routes/seeker.http.ts",
  "src/routes/contact.http.ts",
  "src/lib/http/api-response.ts",
  "src/lib/supabase/user-server-client.ts",
  "src/lib/auth/constants.ts",
  "src/middleware.ts",
];

let failed = false;
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error("Missing:", rel);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("OK — all Step 5 API files present (" + required.length + " paths).");
