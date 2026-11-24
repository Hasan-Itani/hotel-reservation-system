import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { SendTransactionalEmail } from "../common/resend-sender";

export type PaymentReceipt = { paymentId: string; remaining: number };

const logger = new Logger("PaymentReceipt");

export function getPaymentReceipt(
  payment: { id: string; status: string },
  remaining: number,
  confirmationAlreadyAttempted: boolean,
): PaymentReceipt | undefined {
  if (payment.status !== "PAID" || (remaining <= 0 && !confirmationAlreadyAttempted)) return undefined;
  return { paymentId: payment.id, remaining };
}

export async function tryPaymentReceipt(
  database: Pick<PrismaClient, "payment">,
  receipt: PaymentReceipt,
  send: SendTransactionalEmail | null,
) {
  if (!send) return;

  try {
    const payment = await database.payment.findUnique({
      where: { id: receipt.paymentId, status: "PAID" },
      select: {
        amount: true,
        currency: true,
        isMock: true,
        reservation: {
          select: { id: true, hotelId: true, reservationNumber: true, guestEmail: true, hotel: { select: { name: true } } },
        },
      },
    });
    if (!payment?.reservation.guestEmail) return;

    const { reservation } = payment;
    const formatter = new Intl.NumberFormat("en", { style: "currency", currency: payment.currency });
    const isPartial = receipt.remaining > 0;
    await send({
      to: reservation.guestEmail,
      subject: `${payment.isMock ? "[TEST] " : ""}${isPartial ? "Partial payment received" : "Payment received"}: ${reservation.reservationNumber}`,
      text: [
        isPartial ? "A partial payment was recorded for your booking." : "A payment was recorded and your booking balance is fully paid.",
        `Reservation: ${reservation.reservationNumber}`,
        `Hotel: ${reservation.hotel.name}`,
        `Amount paid this time: ${formatter.format(Number(payment.amount))} ${payment.currency}`,
        `Balance after this payment: ${formatter.format(receipt.remaining)} ${payment.currency}`,
        ...(payment.isMock ? ["This was a test payment. No real charge was made."] : []),
      ].join("\n"),
    }, `${isPartial ? "booking-partial-payment" : "booking-payment"}/${receipt.paymentId}`, {
      hotelId: reservation.hotelId, reservationId: reservation.id, reservationNumber: reservation.reservationNumber,
      emailType: isPartial ? "Partial payment receipt" : "Payment receipt",
    });
  } catch {
    logger.warn("Unable to send the payment receipt. The payment was already recorded.");
  }
}
