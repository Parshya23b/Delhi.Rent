/**
 * HTTP entrypoints for seeker auth APIs (wired from `src/app/api/seeker/.../route.ts`).
 */
import type { NextRequest } from "next/server";
import {
  handleSeekerCreate,
  handleSeekerMatch,
  handleSeekerMatchesGet,
} from "@/controllers/seeker.controller";

export const postSeekerCreate = (req: NextRequest) => handleSeekerCreate(req);
export const postSeekerMatch = (req: NextRequest) => handleSeekerMatch(req);
export const getSeekerMatches = (req: NextRequest) => handleSeekerMatchesGet(req);
