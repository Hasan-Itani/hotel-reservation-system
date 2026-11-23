import { z } from "zod";

export const reservationNumberSchema = z
  .string()
  .trim()
  .min(6)
  .max(50)
  .transform((value) => value.toUpperCase());

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

export const publicBookingAccessQuerySchema = z
  .object({ guestEmail: z.string().trim().toLowerCase().email() })
  .strict();

export const publicBookingPaymentSchema = mockPaymentCreateSchema
  .extend({
    guestEmail: z.string().trim().toLowerCase().email().optional(),
  })
  .strict();

export type PublicBookingPaymentInput = z.infer<typeof publicBookingPaymentSchema>;
