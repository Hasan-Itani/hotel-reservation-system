import "server-only";

import { NextResponse } from "next/server";
import type { PeopleResult } from "@/apps/api/src/admin-people/people-reads";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestJsonRequest, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

async function proxyPeople(request: Request, hotelId: string, resource: string[], hasJsonBody: boolean) {
  if (!isNestApiProxyConfigured()) return null;

  const sessionToken = await getSessionToken();
  const path = ["admin", "hotels", hotelId, ...resource].map(encodeURIComponent).join("/");
  const options = {
    sessionToken: sessionToken ?? undefined,
    rejectRedirects: true,
    unavailableError: "Admin guest and staff service is unavailable. Please try again.",
  };
  return hasJsonBody
    ? proxyNestJsonRequest(request, `/${path}`, options)
    : proxyNestRequest(request, `/${path}`, options);
}

export function proxyAdminPeopleRead(request: Request, hotelId: string, ...resource: string[]) {
  return proxyPeople(request, hotelId, resource, false);
}

export async function handleAdminPeopleWrite(
  request: Request,
  hotelId: string,
  resource: string[],
  hasJsonBody: boolean,
  fallback: (user: Awaited<ReturnType<typeof getCurrentAuthUser>>) => Promise<PeopleResult>,
) {
  const proxied = await proxyPeople(request, hotelId, resource, hasJsonBody);
  if (proxied) return proxied;

  const result = await fallback(await getCurrentAuthUser());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
