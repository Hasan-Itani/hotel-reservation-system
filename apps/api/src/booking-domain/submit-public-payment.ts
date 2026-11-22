import { processPublicPayment } from "./process-public-payment";
import { publicBookingPaymentSchema, publicBookingReservationParamSchema } from "./public-payment-schema";
import type { PrismaClient } from "@prisma/client";

export async function submitPublicPayment(
  database: PrismaClient,
  reservationNumber: string,
  body: unknown,
  getCurrentUser: () => Promise<{ id: string } | null>,
) {
  const parsedParams = publicBookingReservationParamSchema.safeParse({ reservationNumber });
  if (!parsedParams.success) {
    return { status: 400, body: { error: "Invalid reservation number", details: parsedParams.error.flatten() } };
  }

  const parsedBody = publicBookingPaymentSchema.safeParse(body);
  if (!parsedBody.success) {
    return { status: 400, body: { error: "Invalid payment data", details: parsedBody.error.flatten() } };
  }

  return processPublicPayment(database, parsedParams.data.reservationNumber, parsedBody.data, await getCurrentUser());
}
