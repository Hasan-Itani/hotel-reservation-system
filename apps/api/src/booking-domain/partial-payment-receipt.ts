import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { SendTransactionalEmail } from "../common/resend-sender";

export type PartialPaymentReceipt = { paymentId: string; remaining: number };

const logger = new Logger("PartialPaymentReceipt");

export function getPartialPaymentReceipt(
  payment: { id: string; status: string },
  remaining: number,
): PartialPaymentReceipt | undefined {
  if (payment.status !== "PAID" || remaining <= 0) return undefined;
  return { paymentId: payment.id, remaining };
}

export async function tryPartialPaymentReceipt(
  database: Pick<PrismaClient, "payment">,
  receipt: PartialPaymentReceipt,
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
          select: { reservationNumber: true, guestEmail: true, hotel: { select: { name: true } } },
        },
      },
    });
    if (!payment?.reservation.guestEmail) return;

    const { reservation } = payment;
    const formatter = new Intl.NumberFormat("en", { style: "currency", currency: payment.currency });
    await send({
      to: reservation.guestEmail,
      subject: `${payment.isMock ? "[TEST] " : ""}Partial payment received: ${reservation.reservationNumber}`,
      text: [
        "A partial payment was recorded for your booking.",
        `Reservation: ${reservation.reservationNumber}`,
        `Hotel: ${reservation.hotel.name}`,
        `Amount paid this time: ${formatter.format(Number(payment.amount))} ${payment.currency}`,
        `Balance after this payment: ${formatter.format(receipt.remaining)} ${payment.currency}`,
        ...(payment.isMock ? ["This was a test payment. No real charge was made."] : []),
      ].join("\n"),
    }, `booking-partial-payment/${receipt.paymentId}`);
  } catch {
    logger.warn("Unable to send the partial-payment receipt. The payment was already recorded.");
  }
}
