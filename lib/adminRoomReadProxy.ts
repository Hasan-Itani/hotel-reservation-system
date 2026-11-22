import "server-only";

import { isNestApiProxyConfigured, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

export async function proxyAdminRoomRead(request: Request, hotelId: string, ...resource: string[]) {
  if (!isNestApiProxyConfigured()) {
    return null;
  }

  const sessionToken = await getSessionToken();
  const path = ["admin", "hotels", hotelId, ...resource].map(encodeURIComponent).join("/");
  return proxyNestRequest(request, `/${path}`, {
    sessionToken: sessionToken ?? undefined,
    rejectRedirects: true,
    unavailableError: "Admin inventory service is unavailable",
  });
}
