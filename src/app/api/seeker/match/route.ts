import type { NextRequest } from "next/server";
import { postSeekerMatch } from "@/routes/seeker.http";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return postSeekerMatch(req);
}
