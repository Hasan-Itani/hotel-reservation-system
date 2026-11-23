import { canAccessHotel, hasGlobalRole, hasHotelRole, type AuthUser } from "../common/permissions";

export type InventoryWriteResult = { status: number; body: object };

export function inventoryResponse(body: object, { status = 200 }: { status?: number } = {}): InventoryWriteResult {
  return { body, status };
}

export function getInventoryWriteAccess(user: AuthUser | null, hotelId: string) {
  if (!user) {
    return { ok: false as const, result: inventoryResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccessHotel(user, hotelId)) {
    return { ok: false as const, result: inventoryResponse({ error: "You do not have access to this hotel" }, { status: 403 }) };
  }
  if (!hasGlobalRole(user, "SUPER_ADMIN") && !hasHotelRole(user, hotelId, "HOTEL_ADMIN") && !hasHotelRole(user, hotelId, "MANAGER")) {
    return { ok: false as const, result: inventoryResponse({ error: "Requires HOTEL_ADMIN or MANAGER role for this hotel" }, { status: 403 }) };
  }
  return { ok: true as const, user };
}
