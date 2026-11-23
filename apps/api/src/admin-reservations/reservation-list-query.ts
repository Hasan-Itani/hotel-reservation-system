import { z } from "zod";
import { dateOnlySchema } from "../booking-domain/public-reservation-schema";

const reservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

export const reservationListQuerySchema = z
  .object({
    view: z.enum(["summary", "full"]).optional(),
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
