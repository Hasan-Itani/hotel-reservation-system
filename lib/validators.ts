import { z } from "zod";
import { reservationListQuerySchema } from "../apps/api/src/admin-reservations/reservation-list-query";
export { reservationListQuerySchema };
import {
  roomCreateSchema,
  roomUpdateSchema,
  roomTypeCreateSchema,
  roomTypeUpdateSchema,
} from "../apps/api/src/admin-rooms/room-schemas";
import { createNullableTrimmedString, updateNullableTrimmedString } from "../apps/api/src/common/nullable-text";
export { roomCreateSchema, roomUpdateSchema, roomTypeCreateSchema, roomTypeUpdateSchema };
import {
  mockPaymentCreateSchema,
  publicBookingPaymentSchema,
  publicBookingReservationParamSchema,
  reservationNumberSchema,
} from "../apps/api/src/booking-domain/public-payment-schema";
export { mockPaymentCreateSchema, publicBookingPaymentSchema, publicBookingReservationParamSchema };
import {
  dateOnlySchema,
  publicReservationCreateSchema,
  reservationRoomInputSchema,
} from "../apps/api/src/booking-domain/public-reservation-schema";
export { publicReservationCreateSchema, reservationRoomInputSchema };
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";

const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
  })
  .regex(/[a-z]/, { message: "Password must include a lowercase letter" })
  .regex(/[A-Z]/, { message: "Password must include an uppercase letter" })
  .regex(/\d/, { message: "Password must include a number" })
  .regex(/[^A-Za-z0-9\s]/, { message: "Password must include a symbol" });

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
    password: newPasswordSchema,
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(32).max(300),
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
    password: newPasswordSchema,
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

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
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
