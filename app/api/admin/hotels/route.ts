import { NextResponse } from "next/server";
import { listAdminHotels } from "@/apps/api/src/admin-people/people-reads";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestRequest } from "@/lib/nestApiProxy";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    const proxied = await proxyNestRequest(request, "/admin/hotels", {
      sessionToken: sessionToken ?? undefined,
      rejectRedirects: true,
      unavailableError: "Admin hotel list is unavailable. Please try again.",
    });
    if (proxied) return proxied;
  }

  const result = await listAdminHotels(prisma, await getCurrentAuthUser());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
