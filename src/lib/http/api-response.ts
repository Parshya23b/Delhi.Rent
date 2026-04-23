import { NextResponse } from "next/server";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiErrorBody = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export function jsonOk<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonErr(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    ok: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return NextResponse.json(body, { status });
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
