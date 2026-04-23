import type { NextRequest } from "next/server";
import { postContactRequest } from "@/routes/contact.http";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return postContactRequest(req);
}
