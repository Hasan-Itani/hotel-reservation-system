import { NextResponse } from "next/server";
import { proxyNestRequest } from "@/lib/nestApiProxy";
import { clearSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  await clearSessionCookie();

  const response = await proxyNestRequest(request, "/auth/logout", {
    jsonBody: "{}",
    signal: AbortSignal.timeout(2000),
  });
  const cacheControl = "private, no-store";
  if (response.ok) {
    response.headers.set("Cache-Control", cacheControl);
    return response;
  }

  return NextResponse.json(
    { message: "Logout successful" },
    { headers: { "Cache-Control": cacheControl } },
  );
}
