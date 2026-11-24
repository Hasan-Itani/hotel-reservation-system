import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { hasSuccessfulPaymentStatus } from "../booking-domain/paid-confirmation-email";
import type { SendTransactionalEmail } from "../common/resend-sender";
import type { ReservationWriteResult } from "./reservation-write-access";

const logger = new Logger("MockRefundNotice");

export async function notifyMockRefund(
  database: Pick<PrismaClient, "payment">,
  scope: { hotelId: string; reservationId: string; paymentId: string },
  result: ReservationWriteResult,
  send: SendTransactionalEmail | null,
) {
  if (!send || !hasSuccessfulPaymentStatus(result, "REFUNDED")) return result;

  try {
    const payment = await database.payment.findFirst({
      where: {
        id: scope.paymentId,
        reservationId: scope.reservationId,
        reservation: { hotelId: scope.hotelId },
        status: "REFUNDED",
        isMock: true,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        reservation: {
          select: { reservationNumber: true, guestEmail: true, hotel: { select: { name: true } } },
        },
      },
    });
    if (!payment?.reservation.guestEmail) return result;

    const { reservation } = payment;
    const amount = new Intl.NumberFormat("en", { style: "currency", currency: payment.currency })
      .format(Number(payment.amount));
    await send({
      to: reservation.guestEmail,
      subject: `[TEST] Refund recorded: ${reservation.reservationNumber}`,
      text: [
        "A full test refund was recorded for a payment on your booking.",
        `Reservation: ${reservation.reservationNumber}`,
        `Hotel: ${reservation.hotel.name}`,
        `Total now recorded as refunded for this payment: ${amount} ${payment.currency}`,
        "No real money was returned or credited to a card.",
        "This refund notice does not cancel your reservation.",
      ].join("\n"),
    }, `booking-refund/${payment.id}`);
  } catch {
    logger.warn("Unable to send the refund notice. The refund was already recorded.");
  }

  return result;
}
