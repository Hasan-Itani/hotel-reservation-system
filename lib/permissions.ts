export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  globalRoles: string[];
  hotelRoles: Array<{
    hotelId: string;
    hotelName: string;
    role: string;
  }>;
};

export function hasGlobalRole(user: AuthUser, roleName: string) {
  return user.globalRoles.includes(roleName);
}

export function hasHotelRole(user: AuthUser, hotelId: string, roleName: string) {
  return user.hotelRoles.some(
    (item) => item.hotelId === hotelId && item.role === roleName
  );
}

export function canAccessHotel(user: AuthUser, hotelId: string) {
  if (hasGlobalRole(user, "SUPER_ADMIN")) {
    return true;
  }

  return user.hotelRoles.some((item) => item.hotelId === hotelId);
}