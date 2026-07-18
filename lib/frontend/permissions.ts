import {
  GLOBAL_ROLES,
  HOTEL_ROLES,
  type HotelRole,
} from "@/lib/frontend/roles";
import type { AuthUser } from "@/lib/frontend/types";

export function hasGlobalRole(user: AuthUser, roleName: string) {
  return user.globalRoles.includes(roleName);
}

export function isSuperAdmin(user: AuthUser) {
  return hasGlobalRole(user, GLOBAL_ROLES.SUPER_ADMIN);
}

export function hasAnyHotelRole(user: AuthUser) {
  return user.hotelRoles.length > 0;
}

export function canEnterAdmin(user: AuthUser) {
  return isSuperAdmin(user) || hasAnyHotelRole(user);
}

export function hasHotelRole(
  user: AuthUser,
  hotelId: string,
  roleName: HotelRole,
) {
  if (isSuperAdmin(user)) {
    return true;
  }

  return user.hotelRoles.some(
    (item) => item.hotelId === hotelId && item.role === roleName,
  );
}

export function canAccessSelectedHotel(user: AuthUser, hotelId: string) {
  if (isSuperAdmin(user)) {
    return true;
  }

  return user.hotelRoles.some((item) => item.hotelId === hotelId);
}

export function canManageStaff(user: AuthUser, hotelId: string) {
  return hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN);
}

export function canManageHotelSetup(user: AuthUser, hotelId: string) {
  return (
    hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.MANAGER)
  );
}

export function canManageReservations(user: AuthUser, hotelId: string) {
  return (
    hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.MANAGER) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.RECEPTIONIST)
  );
}

export function canManagePayments(user: AuthUser, hotelId: string) {
  return (
    hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.MANAGER) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.RECEPTIONIST)
  );
}

export function canManageRooms(user: AuthUser, hotelId: string) {
  return (
    hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.MANAGER)
  );
}

export function canViewGuests(user: AuthUser, hotelId: string) {
  return (
    hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.MANAGER) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.RECEPTIONIST)
  );
}

export function canUnlockGuestAccounts(user: AuthUser, hotelId: string) {
  return hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN);
}

export function canViewAudit(user: AuthUser, hotelId: string) {
  return (
    hasHotelRole(user, hotelId, HOTEL_ROLES.HOTEL_ADMIN) ||
    hasHotelRole(user, hotelId, HOTEL_ROLES.MANAGER)
  );
}
