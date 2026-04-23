import type { NextRequest } from "next/server";
import { postContactRespond } from "@/routes/contact.http";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return postContactRespond(req);
}
