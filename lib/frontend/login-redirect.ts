import {
  canAccessSelectedHotel,
  canEnterAdmin,
  canManageHotelSetup,
  canManagePayments,
  canManageReservations,
  canManageRooms,
  canManageStaff,
  canViewAudit,
  canViewGuests,
  isSuperAdmin,
} from "./permissions";
import { getOptionalRedirectPath } from "./safe-redirect";
import type { AuthUser } from "./types";

const adminPagePermissions = new Map([
  ["/admin/rooms", canManageRooms],
  ["/admin/room-types", canManageHotelSetup],
  ["/admin/reservations", canManageReservations],
  ["/admin/payments", canManagePayments],
  ["/admin/guests", canViewGuests],
  ["/admin/inquiries", canViewGuests],
  ["/admin/staff", canManageStaff],
  ["/admin/audit", canViewAudit],
]);

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
  if (!canAccessAdmin) {
    return fallback;
  }

  const canOpenPage = adminPagePermissions.get(pathname);
  if (pathname !== "/admin" && !canOpenPage) {
    return fallback;
  }
  const hotelId = url.searchParams.get("hotelId");
  if (hotelId) {
    return canAccessSelectedHotel(user, hotelId) && (!canOpenPage || canOpenPage(user, hotelId))
      ? next
      : fallback;
  }
  return !canOpenPage || isSuperAdmin(user) ||
    user.hotelRoles.some((role) => canOpenPage(user, role.hotelId))
    ? next
    : fallback;
}
