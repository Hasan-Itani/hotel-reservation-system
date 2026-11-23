import { z } from "zod";

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
