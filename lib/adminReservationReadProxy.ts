import "server-only";

import { NextResponse } from "next/server";
import type { ReservationWriteResult } from "@/apps/api/src/admin-reservations/reservation-write-access";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestJsonRequest, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

async function proxyReservation(request: Request, hotelId: string, resource: string[]) {
  if (!isNestApiProxyConfigured()) return null;

  const sessionToken = await getSessionToken();
  const path = ["admin", "hotels", hotelId, "reservations", ...resource].map(encodeURIComponent).join("/");
  const options = {
    sessionToken: sessionToken ?? undefined,
    rejectRedirects: true,
    unavailableError: "Admin reservations service is unavailable. Please try again.",
  };
  return request.method === "POST" || request.method === "PATCH"
    ? proxyNestJsonRequest(request, `/${path}`, options)
    : proxyNestRequest(request, `/${path}`, options);
}

export function proxyAdminReservationRead(request: Request, hotelId: string, ...resource: string[]) {
  return proxyReservation(request, hotelId, resource);
}

export async function handleAdminReservationWrite(
  request: Request,
  hotelId: string,
  resource: string[],
  fallback: (user: Awaited<ReturnType<typeof getCurrentAuthUser>>) => Promise<ReservationWriteResult>,
) {
  const proxied = await proxyReservation(request, hotelId, resource);
  if (proxied) return proxied;

  const result = await fallback(await getCurrentAuthUser());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
