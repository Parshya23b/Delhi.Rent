import type { NextRequest } from "next/server";
import { getSeekerMatches } from "@/routes/seeker.http";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return getSeekerMatches(req);
}
