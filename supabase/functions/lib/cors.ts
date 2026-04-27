export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(status: number, message: string, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error: message, ...extra }, { status });
}
