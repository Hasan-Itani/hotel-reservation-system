import "server-only";

import { isNestApiProxyConfigured, proxyNestRequest } from "@/lib/nestApiProxy";
import { getSessionToken } from "@/lib/session";

export async function proxyAdminReservationRead(request: Request, hotelId: string, ...resource: string[]) {
  if (!isNestApiProxyConfigured()) return null;

  const sessionToken = await getSessionToken();
  const path = ["admin", "hotels", hotelId, "reservations", ...resource].map(encodeURIComponent).join("/");
  return proxyNestRequest(request, `/${path}`, {
    sessionToken: sessionToken ?? undefined,
    rejectRedirects: true,
    unavailableError: "Admin reservations service is unavailable. Please try again.",
  });
}
