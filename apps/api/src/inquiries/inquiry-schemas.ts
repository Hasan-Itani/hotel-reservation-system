import { z } from "zod";

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
