import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { HEADER_USER_ID } from "@/lib/auth/constants";

function jsonUnauthorized(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "UNAUTHORIZED", message } },
    { status: 401 },
  );
}

/**
 * Step 6 — Validates Supabase JWT for seeker + contact APIs, strips spoofed
 * identity headers, attaches {@link HEADER_USER_ID} for downstream handlers.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/seeker") && !pathname.startsWith("/api/contact")) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CONFIG",
          message: "Supabase URL or anon key is not configured.",
        },
      },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  const token =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  if (!token) {
    return jsonUnauthorized("Missing Authorization: Bearer <access_token>.");
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user?.id) {
    return jsonUnauthorized("Invalid or expired access token.");
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(HEADER_USER_ID);

  requestHeaders.set(HEADER_USER_ID, user.id);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/seeker/:path*", "/api/contact/:path*"],
};
