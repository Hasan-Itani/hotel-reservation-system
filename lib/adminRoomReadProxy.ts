import "server-only";

import { NextResponse } from "next/server";
import type { InventoryWriteResult } from "@/apps/api/src/admin-rooms/room-write-access";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestJsonRequest, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

async function proxyInventory(request: Request, hotelId: string, resource: string[]) {
  if (!isNestApiProxyConfigured()) return null;

  const sessionToken = await getSessionToken();
  const path = ["admin", "hotels", hotelId, ...resource].map(encodeURIComponent).join("/");
  const options = {
    sessionToken: sessionToken ?? undefined,
    rejectRedirects: true,
    unavailableError: "Admin inventory service is unavailable",
  };
  if (request.method === "POST" || request.method === "PATCH") {
    return proxyNestJsonRequest(request, `/${path}`, options);
  }
  return proxyNestRequest(request, `/${path}`, options);
}

export function proxyAdminRoomRead(request: Request, hotelId: string, ...resource: string[]) {
  return proxyInventory(request, hotelId, resource);
}

export async function handleAdminInventoryWrite(
  request: Request,
  hotelId: string,
  resource: string[],
  fallback: (user: Awaited<ReturnType<typeof getCurrentAuthUser>>) => Promise<InventoryWriteResult>,
) {
  const response = await proxyInventory(request, hotelId, resource);
  if (response) return response;

  const result = await fallback(await getCurrentAuthUser());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
