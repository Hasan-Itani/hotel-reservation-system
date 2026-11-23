import { z } from "zod";
import { dateOnlySchema } from "./public-reservation-schema";

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
