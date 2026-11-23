import { canAccessHotel, hasGlobalRole, hasHotelRole, type AuthUser } from "../common/permissions";

export type ReservationWriteResult = { status: number; body: object };

export function writeResponse(body: object, { status = 200 }: { status?: number } = {}): ReservationWriteResult {
  return { body, status };
}

export function requireReservationWriteAccess(user: AuthUser | null, hotelId: string) {
  if (!user) {
    return { ok: false as const, result: writeResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccessHotel(user, hotelId)) {
    return { ok: false as const, result: writeResponse({ error: "You do not have access to this hotel" }, { status: 403 }) };
  }
  const canManage =
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER") ||
    hasHotelRole(user, hotelId, "RECEPTIONIST");
  if (!canManage) {
    return {
      ok: false as const,
      result: writeResponse(
        { error: "Requires HOTEL_ADMIN, MANAGER, or RECEPTIONIST role for this hotel" },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, user };
}
