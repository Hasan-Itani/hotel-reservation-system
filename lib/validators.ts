import { z } from "zod";
import { hotelStaffCreateSchema, hotelStaffUpdateSchema } from "../apps/api/src/admin-people/staff-write-schemas";
export { hotelStaffCreateSchema, hotelStaffUpdateSchema, hotelStaffRoleNamesSchema } from "../apps/api/src/admin-people/staff-write-schemas";
import { paymentStatusUpdateSchema } from "../apps/api/src/admin-reservations/payment-write-schema";
export { paymentStatusUpdateSchema };
import { reservationCreateSchema, reservationUpdateSchema } from "../apps/api/src/admin-reservations/reservation-write-schemas";
export { reservationCreateSchema, reservationUpdateSchema, reservationStatusActionSchema, reservationRoomAssignmentSchema } from "../apps/api/src/admin-reservations/reservation-write-schemas";
import { reservationListQuerySchema } from "../apps/api/src/admin-reservations/reservation-list-query";
export { reservationListQuerySchema };
import {
  roomCreateSchema,
  roomUpdateSchema,
  roomTypeCreateSchema,
  roomTypeUpdateSchema,
} from "../apps/api/src/admin-rooms/room-schemas";
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

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type PublicReservationCreateInput = z.infer<
  typeof publicReservationCreateSchema
>;
export type ReservationListQueryInput = z.infer<
  typeof reservationListQuerySchema
>;

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
