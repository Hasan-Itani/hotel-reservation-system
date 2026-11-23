import "server-only";

import { NextResponse } from "next/server";
import type { ActivityResult } from "@/apps/api/src/inquiries/activity-response";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestJsonRequest, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

export async function handleAdminActivity(
  request: Request,
  hotelId: string,
  resource: string[],
  fallback: (user: Awaited<ReturnType<typeof getCurrentAuthUser>>) => Promise<ActivityResult>,
) {
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    const path = ["admin", "hotels", hotelId, ...resource].map(encodeURIComponent).join("/");
    const options = {
      sessionToken: sessionToken ?? undefined,
      rejectRedirects: true,
      unavailableError: "Admin inquiry and audit service is unavailable. Please try again.",
    };
    const proxied = request.method === "PATCH"
      ? await proxyNestJsonRequest(request, `/${path}`, options)
      : await proxyNestRequest(request, `/${path}`, options);
    if (proxied) return proxied;
  }

  const result = await fallback(await getCurrentAuthUser());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
