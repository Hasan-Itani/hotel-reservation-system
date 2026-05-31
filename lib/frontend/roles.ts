export const GLOBAL_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export const HOTEL_ROLES = {
  HOTEL_ADMIN: "HOTEL_ADMIN",
  MANAGER: "MANAGER",
  RECEPTIONIST: "RECEPTIONIST",
} as const;

export const PUBLIC_ROLES = {
  GUEST: "GUEST",
} as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[keyof typeof GLOBAL_ROLES];
export type HotelRole = (typeof HOTEL_ROLES)[keyof typeof HOTEL_ROLES];