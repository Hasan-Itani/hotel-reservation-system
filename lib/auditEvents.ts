import type { Prisma } from "@prisma/client";

export const AUDIT_EVENT_CATEGORIES = {
  AUTH_SECURITY: "AUTH_SECURITY",
} as const;

export type AuditEventCategory =
  (typeof AUDIT_EVENT_CATEGORIES)[keyof typeof AUDIT_EVENT_CATEGORIES];

export const AUTH_SECURITY_AUDIT_ACTIONS = [
  "GUEST_REGISTERED",
  "EMAIL_VERIFICATION_SENT",
  "EMAIL_VERIFIED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_CHANGED",
  "ACCOUNT_LOCKED",
  "ACCOUNT_UNLOCKED",
] as const;

export function isAuthSecurityAuditAction(action: string) {
  return AUTH_SECURITY_AUDIT_ACTIONS.some((item) => item === action);
}

export function normalizeAuditEventCategory(
  value: string | null | undefined,
): AuditEventCategory | undefined {
  return value === AUDIT_EVENT_CATEGORIES.AUTH_SECURITY ? value : undefined;
}

export function buildAuditCategoryWhere(
  category: AuditEventCategory | undefined,
): Prisma.AuditLogWhereInput | null {
  if (category !== AUDIT_EVENT_CATEGORIES.AUTH_SECURITY) return null;

  return {
    action: {
      in: [...AUTH_SECURITY_AUDIT_ACTIONS],
    },
  };
}

export function buildHotelAuditVisibilityWhere(
  hotelId: string,
): Prisma.AuditLogWhereInput {
  return {
    OR: [
      { hotelId },
      {
        hotelId: null,
        action: {
          in: [...AUTH_SECURITY_AUDIT_ACTIONS],
        },
        actor: {
          is: {
            OR: [
              {
                reservations: {
                  some: { hotelId },
                },
              },
              {
                UserHotelRole: {
                  some: { hotelId },
                },
              },
            ],
          },
        },
      },
    ],
  };
}