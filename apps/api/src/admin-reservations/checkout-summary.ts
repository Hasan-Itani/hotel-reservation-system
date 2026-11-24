import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { addMoney } from "../booking-domain/money";
import { calculatePaidAmount, calculateRemainingBalance } from "../booking-domain/reservation-payments";
import type { SendTransactionalEmail } from "../common/resend-sender";
import type { ReservationUpdateResult } from "./reservation-writes";

const logger = new Logger("CheckoutSummary");

export async function notifyCheckoutSummary(
  database: Pick<PrismaClient, "reservation">,
  scope: { hotelId: string; reservationId: string },
  result: ReservationUpdateResult,
  send: SendTransactionalEmail | null,
) {
  if (!send || !result.checkoutCompleted || result.status !== 200) return result;

  try {
    const booking = await database.reservation.findFirst({
      where: { id: scope.reservationId, hotelId: scope.hotelId, status: "CHECKED_OUT" },
      select: {
        id: true,
        reservationNumber: true,
        guestEmail: true,
        checkInDate: true,
        checkOutDate: true,
        total: true,
        currency: true,
        hotel: { select: { name: true } },
        payments: {
          where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } },
          select: { amount: true, status: true, isMock: true },
        },
      },
    });
    if (!booking?.guestEmail) return result;

    const formatter = new Intl.NumberFormat("en", { style: "currency", currency: booking.currency });
    const formatAmount = (amount: number) => `${formatter.format(amount)} ${booking.currency}`;
    const paid = calculatePaidAmount(booking.payments);
    const refunded = addMoney(...booking.payments.filter(({ status }) => status === "REFUNDED").map(({ amount }) => amount));
    const hasUnknownRefundAmount = booking.payments.some(({ status }) => status === "PARTIALLY_REFUNDED");
    const includesMock = booking.payments.some(({ isMock }) => isMock);
    await send({
      to: booking.guestEmail,
      subject: `${includesMock ? "[TEST] " : ""}Checkout summary: ${booking.reservationNumber}`,
      text: [
        "Your reservation has been checked out.",
        `Reservation: ${booking.reservationNumber}`,
        `Hotel: ${booking.hotel.name}`,
        `Booked stay: ${booking.checkInDate.toISOString().slice(0, 10)} to ${booking.checkOutDate.toISOString().slice(0, 10)}`,
        `Booking total: ${formatAmount(Number(booking.total))}`,
        `${hasUnknownRefundAmount ? "Paid (excluding partially refunded payments)" : "Payments still applied"}: ${formatAmount(paid)}`,
        `Full refunds recorded: ${formatAmount(refunded)}`,
        hasUnknownRefundAmount
          ? "Balance not available: at least one partial refund has no recorded amount. Contact the hotel for the current balance."
          : `Balance due: ${formatAmount(calculateRemainingBalance(booking.total, paid))}`,
        "Checkout did not create a charge or change any payment.",
        ...(includesMock ? ["Test transactions in this summary did not move real money."] : []),
      ].join("\n"),
    }, `booking-checkout/${booking.id}`);
  } catch {
    logger.warn("Unable to send the checkout summary. The checkout was already recorded.");
  }

  return result;
}
