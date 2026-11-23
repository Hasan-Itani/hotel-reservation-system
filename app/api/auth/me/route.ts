import { NextResponse } from "next/server";
import { proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return proxyNestRequest(request, "/auth/me", { sessionToken });
}
