import { canEnterAdmin, canOpenAdminSection } from "./permissions";
import { getOptionalRedirectPath } from "./safe-redirect";
import type { AuthUser } from "./types";

export function getLoginRedirectPath(user: AuthUser, requestedPath: unknown) {
  const canAccessAdmin = canEnterAdmin(user);
  const fallback = canAccessAdmin ? "/admin" : "/guest/account";
  const next = getOptionalRedirectPath(requestedPath);
  if (!next) {
    return fallback;
  }

  const url = new URL(next, "https://hotel.local");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/login" || pathname === "/guest/login") {
    return fallback;
  }
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) {
    return next;
  }
  return canOpenAdminSection(user, pathname, url.searchParams.get("hotelId") || undefined)
    ? next
    : fallback;
}
