import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must contain only lowercase letters, numbers, and hyphens",
  });

const createNullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => {
      if (value === undefined) return null;
      return value.length === 0 ? null : value;
    });

const updateNullableTrimmedString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      return value.length === 0 ? null : value;
    });

const roomTypeImageSchema = z
  .object({
    url: z.string().trim().url().max(2048),
    altText: createNullableTrimmedString(200),
    sortOrder: z.coerce.number().int().min(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();

function validateRoomTypeImages(
  images: Array<{
    url: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }>,
  ctx: z.RefinementCtx,
) {
  const usedSortOrders = new Set<number>();
  let primaryCount = 0;

  images.forEach((image, index) => {
    if (usedSortOrders.has(image.sortOrder)) {
      ctx.addIssue({
        code: "custom",
        path: ["images", index, "sortOrder"],
        message: "Each image must have a unique sortOrder",
      });
    } else {
      usedSortOrders.add(image.sortOrder);
    }

    if (image.isPrimary) {
      primaryCount += 1;
    }
  });

  if (primaryCount > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["images"],
      message: "Only one image can be marked as primary",
    });
  }
}

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(100),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32).max(300),
    password: z.string().min(8).max(100),
  })
  .strict();

export const guestRegisterSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email(),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((value) => {
        if (value === undefined) return null;
        return value.length === 0 ? null : value;
      }),
    password: z.string().min(8).max(100),
  })
  .strict();

export const guestProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((value) => {
        if (value === undefined) return null;
        return value.length === 0 ? null : value;
      }),
  })
  .strict();

const manuallyManageableRoomStatusSchema = z.enum([
  "AVAILABLE",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
  "CLEANING",
]);

export const roomCreateSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    roomNumber: z.string().trim().min(1).max(20),
    floor: z
      .union([z.coerce.number().int(), z.null()])
      .optional()
      .transform((value) => value ?? null),
    status: manuallyManageableRoomStatusSchema.default("AVAILABLE"),
    notes: createNullableTrimmedString(1000),
  })
  .strict();

export const roomUpdateSchema = z
  .object({
    roomTypeId: z.string().uuid().optional(),
    roomNumber: z.string().trim().min(1).max(20).optional(),
    floor: z.union([z.coerce.number().int(), z.null()]).optional(),
    status: manuallyManageableRoomStatusSchema.optional(),
    notes: updateNullableTrimmedString(1000),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const roomTypeCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(),
    description: createNullableTrimmedString(2000),
    basePrice: z.coerce.number().min(0),
    capacityAdults: z.coerce.number().int().min(1).max(20),
    capacityChildren: z.coerce.number().int().min(0).max(20).default(0),
    bedType: createNullableTrimmedString(100),
    roomSizeSqm: z
      .union([z.coerce.number().positive(), z.null()])
      .optional()
      .transform((value) => value ?? null),
    amenityIds: z
      .array(z.string().uuid())
      .default([])
      .transform((ids) => [...new Set(ids)]),
    images: z.array(roomTypeImageSchema).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateRoomTypeImages(data.images, ctx);
  });

export const roomTypeUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    description: updateNullableTrimmedString(2000),
    basePrice: z.coerce.number().min(0).optional(),
    capacityAdults: z.coerce.number().int().min(1).max(20).optional(),
    capacityChildren: z.coerce.number().int().min(0).max(20).optional(),
    bedType: updateNullableTrimmedString(100),
    roomSizeSqm: z.union([z.coerce.number().positive(), z.null()]).optional(),
    amenityIds: z
      .array(z.string().uuid())
      .optional()
      .transform((ids) => {
        if (ids === undefined) return undefined;
        return [...new Set(ids)];
      }),
    images: z.array(roomTypeImageSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.images) {
      validateRoomTypeImages(data.images, ctx);
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GuestRegisterInput = z.infer<typeof guestRegisterSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
export type RoomTypeCreateInput = z.infer<typeof roomTypeCreateSchema>;
export type RoomTypeUpdateInput = z.infer<typeof roomTypeUpdateSchema>;

const allowedHotelStaffRoleNames = [
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
] as const;

const hotelStaffRoleNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((value) => value.toUpperCase())
  .refine(
    (value) =>
      allowedHotelStaffRoleNames.includes(
        value as (typeof allowedHotelStaffRoleNames)[number],
      ),
    {
      message:
        "Hotel staff roles must be HOTEL_ADMIN, MANAGER, or RECEPTIONIST",
    },
  );

export const hotelStaffRoleNamesSchema = z
  .array(hotelStaffRoleNameSchema)
  .min(1)
  .transform((roleNames) => [...new Set(roleNames)]);

export const hotelStaffCreateSchema = z
  .object({
    userId: z.string().uuid().optional(),

    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: createNullableTrimmedString(30),
    password: z.string().min(8).max(100).optional(),

    roleNames: hotelStaffRoleNamesSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasExistingUserId = !!data.userId;

    const hasNewUserFields =
      !!data.firstName || !!data.lastName || !!data.email || !!data.password;

    if (hasExistingUserId && hasNewUserFields) {
      ctx.addIssue({
        code: "custom",
        message: "Use either userId or new staff fields, not both",
        path: ["userId"],
      });

      return;
    }

    if (!hasExistingUserId) {
      if (!data.firstName) {
        ctx.addIssue({
          code: "custom",
          message: "First name is required",
          path: ["firstName"],
        });
      }

      if (!data.lastName) {
        ctx.addIssue({
          code: "custom",
          message: "Last name is required",
          path: ["lastName"],
        });
      }

      if (!data.email) {
        ctx.addIssue({
          code: "custom",
          message: "Email is required",
          path: ["email"],
        });
      }

      if (!data.password) {
        ctx.addIssue({
          code: "custom",
          message: "Password is required",
          path: ["password"],
        });
      }
    }
  });

export const hotelStaffUpdateSchema = z
  .object({
    roleNames: hotelStaffRoleNamesSchema,
  })
  .strict();

export type HotelStaffCreateInput = z.infer<typeof hotelStaffCreateSchema>;
export type HotelStaffUpdateInput = z.infer<typeof hotelStaffUpdateSchema>;

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be in YYYY-MM-DD format",
  })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    {
      message: "Date must be a valid calendar date",
    },
  );

const reservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

const reservationNumberSchema = z
  .string()
  .trim()
  .min(6)
  .max(50)
  .transform((value) => value.toUpperCase());

export const availabilityQuerySchema = z
  .object({
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20).optional(),
    children: z.coerce.number().int().min(0).max(20).optional(),
  })
  .strict()
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: "checkOutDate must be after checkInDate",
    path: ["checkOutDate"],
  });

export const reservationRoomInputSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    guests: z.coerce.number().int().min(1).max(20),
  })
  .strict();

export const reservationCreateSchema = z
  .object({
    userId: z.string().uuid().optional(),
    guestFirstName: z.string().trim().min(1).max(100),
    guestLastName: z.string().trim().min(1).max(100),
    guestEmail: z.string().trim().toLowerCase().email(),
    guestPhone: createNullableTrimmedString(30),
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    specialRequests: createNullableTrimmedString(2000),
    discountAmount: z.coerce.number().min(0).default(0),
    serviceFee: z.coerce.number().min(0).default(0),
    taxes: z.coerce.number().min(0).default(0),
    rooms: z.array(reservationRoomInputSchema).min(1).max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.checkOutDate <= data.checkInDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message: "checkOutDate must be after checkInDate",
      });
    }

    const totalRequestedGuests = data.rooms.reduce(
      (sum, room) => sum + room.guests,
      0,
    );

    if (totalRequestedGuests < data.adults + data.children) {
      ctx.addIssue({
        code: "custom",
        path: ["rooms"],
        message:
          "Selected rooms do not have enough total guest capacity for this reservation",
      });
    }
  });

export const publicReservationCreateSchema = z
  .object({
    guestFirstName: z.string().trim().min(1).max(100),
    guestLastName: z.string().trim().min(1).max(100),
    guestEmail: z.string().trim().toLowerCase().email(),
    guestPhone: createNullableTrimmedString(30),
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    specialRequests: createNullableTrimmedString(2000),
    rooms: z.array(reservationRoomInputSchema).min(1).max(10),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.checkOutDate <= data.checkInDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message: "checkOutDate must be after checkInDate",
      });
    }

    const totalRequestedGuests = data.rooms.reduce(
      (sum, room) => sum + room.guests,
      0,
    );

    if (totalRequestedGuests < data.adults + data.children) {
      ctx.addIssue({
        code: "custom",
        path: ["rooms"],
        message:
          "Selected rooms do not have enough total guest capacity for this booking",
      });
    }
  });

export const reservationListQuerySchema = z
  .object({
    status: reservationStatusSchema.optional(),
    guestEmail: z.string().trim().toLowerCase().email().optional(),
    checkInFrom: dateOnlySchema.optional(),
    checkInTo: dateOnlySchema.optional(),
    checkOutFrom: dateOnlySchema.optional(),
    checkOutTo: dateOnlySchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.checkInFrom &&
      data.checkInTo &&
      data.checkInTo < data.checkInFrom
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkInTo"],
        message: "checkInTo must be on or after checkInFrom",
      });
    }

    if (
      data.checkOutFrom &&
      data.checkOutTo &&
      data.checkOutTo < data.checkOutFrom
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutTo"],
        message: "checkOutTo must be on or after checkOutFrom",
      });
    }
  });

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type PublicReservationCreateInput = z.infer<
  typeof publicReservationCreateSchema
>;
export type ReservationListQueryInput = z.infer<
  typeof reservationListQuerySchema
>;

export const reservationStatusActionSchema = z.enum([
  "CONFIRM",
  "CANCEL",
  "CHECK_IN",
  "CHECK_OUT",
  "NO_SHOW",
]);

export const reservationRoomAssignmentSchema = z
  .object({
    reservationRoomId: z.string().uuid(),
    roomId: z.string().uuid(),
  })
  .strict();

export const reservationUpdateSchema = z
  .object({
    action: reservationStatusActionSchema,
    cancellationReason: updateNullableTrimmedString(1000),
    roomAssignments: z.array(reservationRoomAssignmentSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action !== "CANCEL" && data.cancellationReason !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["cancellationReason"],
        message: "cancellationReason is only allowed for CANCEL",
      });
    }

    if (data.action !== "CHECK_IN" && data.roomAssignments !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["roomAssignments"],
        message: "roomAssignments are only allowed for CHECK_IN",
      });
    }

    if (
      data.action === "CHECK_IN" &&
      (!data.roomAssignments || data.roomAssignments.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["roomAssignments"],
        message: "roomAssignments are required for CHECK_IN",
      });
    }

    if (data.roomAssignments) {
      const reservationRoomIds = new Set<string>();
      const roomIds = new Set<string>();

      data.roomAssignments.forEach((item, index) => {
        if (reservationRoomIds.has(item.reservationRoomId)) {
          ctx.addIssue({
            code: "custom",
            path: ["roomAssignments", index, "reservationRoomId"],
            message: "reservationRoomId must be unique",
          });
        } else {
          reservationRoomIds.add(item.reservationRoomId);
        }

        if (roomIds.has(item.roomId)) {
          ctx.addIssue({
            code: "custom",
            path: ["roomAssignments", index, "roomId"],
            message: "roomId must be unique",
          });
        } else {
          roomIds.add(item.roomId);
        }
      });
    }
  });

export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;

const mockCardNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => /^\d{13,19}$/.test(value), {
    message: "Card number must contain 13 to 19 digits",
  });

const mockCardCvvSchema = z
  .string()
  .trim()
  .refine((value) => /^\d{3,4}$/.test(value), {
    message: "CVV must be 3 or 4 digits",
  });

export const mockPaymentCreateSchema = z
  .object({
    amount: z.coerce.number().positive().max(100000).optional(),
    cardHolderName: z.string().trim().min(2).max(120),
    cardNumber: mockCardNumberSchema,
    expiryMonth: z.coerce.number().int().min(1).max(12),
    expiryYear: z.coerce.number().int().min(2026).max(2100),
    cvv: mockCardCvvSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const expiryDate = new Date(
      data.expiryYear,
      data.expiryMonth,
      0,
      23,
      59,
      59,
      999,
    );
    const now = new Date();

    if (expiryDate < now) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryYear"],
        message: "Card expiry date cannot be in the past",
      });
    }
  });

export const publicBookingReservationParamSchema = z
  .object({
    reservationNumber: reservationNumberSchema,
  })
  .strict();

export const publicBookingLookupSchema = z
  .object({
    reservationNumber: reservationNumberSchema,
    guestEmail: z.string().trim().toLowerCase().email(),
  })
  .strict();

export const publicBookingAccessQuerySchema = z
  .object({
    guestEmail: z.string().trim().toLowerCase().email(),
  })
  .strict();

export const publicBookingPaymentSchema = mockPaymentCreateSchema
  .extend({
    guestEmail: z.string().trim().toLowerCase().email().optional(),
  })
  .strict();

export type PublicBookingReservationParamInput = z.infer<
  typeof publicBookingReservationParamSchema
>;
export type PublicBookingLookupInput = z.infer<
  typeof publicBookingLookupSchema
>;
export type PublicBookingAccessQueryInput = z.infer<
  typeof publicBookingAccessQuerySchema
>;
export type PublicBookingPaymentInput = z.infer<
  typeof publicBookingPaymentSchema
>;

export const paymentStatusUpdateSchema = z
  .object({
    action: z.enum([
      "MARK_PAID",
      "MARK_FAILED",
      "MARK_REFUNDED",
      "MARK_PARTIALLY_REFUNDED",
    ]),
  })
  .strict();

export type MockPaymentCreateInput = z.infer<typeof mockPaymentCreateSchema>;
export type PaymentStatusUpdateInput = z.infer<
  typeof paymentStatusUpdateSchema
>;

export type GuestProfileUpdateInput = z.infer<typeof guestProfileUpdateSchema>;

export const publicHotelInquiryCreateSchema = z
  .object({
    guestName: z.string().trim().min(1).max(120),
    guestEmail: z.string().trim().toLowerCase().email().max(180),
    guestPhone: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((value) => {
        if (value === undefined) return null;
        return value.length === 0 ? null : value;
      }),
    inquiryType: z
      .enum(["GENERAL", "RESERVATION", "PAYMENT", "DINING", "EVENT", "OTHER"])
      .default("GENERAL"),
    subject: z.string().trim().min(2).max(160),
    message: z.string().trim().min(10).max(4000),
  })
  .strict();

export const adminHotelInquiryUpdateSchema = z
  .object({
    status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]).optional(),
    adminNote: z
      .union([z.string().trim().max(2000), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        return value.length === 0 ? null : value;
      }),
  })
  .strict();
