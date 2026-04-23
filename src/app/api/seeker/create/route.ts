import type { NextRequest } from "next/server";
import { postSeekerCreate } from "@/routes/seeker.http";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return postSeekerCreate(req);
}
