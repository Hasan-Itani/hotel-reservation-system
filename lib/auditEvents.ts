import type { Prisma } from "@prisma/client";

export const AUDIT_EVENT_CATEGORIES = {
  AUTH_SECURITY: "AUTH_SECURITY",
  RESERVATIONS_STAYS: "RESERVATIONS_STAYS",
  ROOMS_INVENTORY: "ROOMS_INVENTORY",
  PAYMENTS: "PAYMENTS",
  STAFF_ACCESS: "STAFF_ACCESS",
  GUEST_INQUIRIES: "GUEST_INQUIRIES",
} as const;

export type AuditEventCategory =
  (typeof AUDIT_EVENT_CATEGORIES)[keyof typeof AUDIT_EVENT_CATEGORIES];

export const AUDIT_EVENT_CATEGORY_OPTIONS: Array<{
  value: AuditEventCategory;
  label: string;
}> = [
  {
    value: AUDIT_EVENT_CATEGORIES.AUTH_SECURITY,
    label: "Authentication & security",
  },
  {
    value: AUDIT_EVENT_CATEGORIES.RESERVATIONS_STAYS,
    label: "Reservations & stays",
  },
  {
    value: AUDIT_EVENT_CATEGORIES.ROOMS_INVENTORY,
    label: "Rooms & inventory",
  },
  {
    value: AUDIT_EVENT_CATEGORIES.PAYMENTS,
    label: "Payments",
  },
  {
    value: AUDIT_EVENT_CATEGORIES.STAFF_ACCESS,
    label: "Staff & access",
  },
  {
    value: AUDIT_EVENT_CATEGORIES.GUEST_INQUIRIES,
    label: "Guest inquiries",
  },
];

export const AUTH_SECURITY_AUDIT_ACTIONS = [
  "GUEST_REGISTERED",
  "EMAIL_VERIFICATION_SENT",
  "EMAIL_VERIFIED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_CHANGED",
  "ACCOUNT_LOCKED",
  "ACCOUNT_UNLOCKED",
] as const;

export const AUDIT_ACTIONS_BY_CATEGORY: Record<
  AuditEventCategory,
  readonly string[]
> = {
  [AUDIT_EVENT_CATEGORIES.AUTH_SECURITY]: AUTH_SECURITY_AUDIT_ACTIONS,
  [AUDIT_EVENT_CATEGORIES.RESERVATIONS_STAYS]: [
    "RESERVATION_CREATED",
    "RESERVATION_CONFIRMED",
    "RESERVATION_CANCELLED",
    "RESERVATION_NO_SHOW",
    "RESERVATION_CHECKED_IN",
    "RESERVATION_CHECKED_OUT",
  ],
  [AUDIT_EVENT_CATEGORIES.ROOMS_INVENTORY]: [
    "ROOM_TYPE_CREATED",
    "ROOM_TYPE_UPDATED",
    "ROOM_TYPE_DELETED",
    "ROOM_CREATED",
    "ROOM_UPDATED",
    "ROOM_DELETED",
  ],
  [AUDIT_EVENT_CATEGORIES.PAYMENTS]: [
    "PAYMENT_CREATED",
    "PAYMENT_STATUS_UPDATED",
  ],
  [AUDIT_EVENT_CATEGORIES.STAFF_ACCESS]: [
    "STAFF_ASSIGNED",
    "STAFF_ROLES_UPDATED",
    "STAFF_REMOVED",
  ],
  [AUDIT_EVENT_CATEGORIES.GUEST_INQUIRIES]: ["INQUIRY_UPDATED"],
};

export function normalizeAuditEventCategory(
  value: string | null | undefined,
): AuditEventCategory | undefined {
  return AUDIT_EVENT_CATEGORY_OPTIONS.some((option) => option.value === value)
    ? (value as AuditEventCategory)
    : undefined;
}

export function getAuditActionsForCategory(
  category: AuditEventCategory | undefined,
) {
  return category ? AUDIT_ACTIONS_BY_CATEGORY[category] : null;
}

export function isAuditActionInCategory(
  action: string,
  category: AuditEventCategory,
) {
  return AUDIT_ACTIONS_BY_CATEGORY[category].some((item) => item === action);
}

export function buildAuditCategoryWhere(
  category: AuditEventCategory | undefined,
): Prisma.AuditLogWhereInput | null {
  const actions = getAuditActionsForCategory(category);

  if (!actions) return null;

  return {
    action: {
      in: [...actions],
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