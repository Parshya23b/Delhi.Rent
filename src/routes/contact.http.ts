/**
 * HTTP entrypoints for contact APIs (wired from `src/app/api/contact/.../route.ts`).
 */
import type { NextRequest } from "next/server";
import { handleContactRequest, handleContactRespond } from "@/controllers/contact.controller";

export const postContactRequest = (req: NextRequest) => handleContactRequest(req);
export const postContactRespond = (req: NextRequest) => handleContactRespond(req);
