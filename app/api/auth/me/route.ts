export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };

  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401, headers },
      );
    }

    const response = await proxyNestRequest(request, "/auth/me", { sessionToken });
    if (response) {
      response.headers.set("Cache-Control", headers["Cache-Control"]);
      return response;
    }
  }

  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401, headers },
    );
  }

  return NextResponse.json({ authenticated: true, user }, { headers });
}
