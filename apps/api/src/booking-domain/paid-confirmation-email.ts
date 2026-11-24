import { Prisma, type PrismaClient } from "@prisma/client";
import type { SendTransactionalEmail } from "../common/resend-sender";
import { calculatePaidAmount, calculateRemainingBalance } from "./reservation-payments";

export function hasSuccessfulPaymentStatus(result: { status: number; body: object }, status: string) {
  if (result.status < 200 || result.status >= 300 || !("payment" in result.body)) return false;
  const payment = result.body.payment;
  return Boolean(payment && typeof payment === "object" && "status" in payment && payment.status === status);
}

export function isPaidPaymentResponse(result: { status: number; body: object }) {
  return hasSuccessfulPaymentStatus(result, "PAID");
}

export async function sendPaidBookingConfirmation(
  database: Pick<PrismaClient, "$transaction">,
  where: Prisma.ReservationWhereUniqueInput,
  send: SendTransactionalEmail,
) {
  const reservation = await database.$transaction(async (tx) => {
    const booking = await tx.reservation.findUnique({
      where: { ...where, status: "CONFIRMED", paidConfirmationEmailAttemptedAt: null },
      select: {
        id: true,
        hotelId: true,
        reservationNumber: true,
        guestEmail: true,
        checkInDate: true,
        checkOutDate: true,
        total: true,
        currency: true,
        hotel: { select: { name: true } },
        payments: { where: { status: "PAID" }, select: { amount: true, status: true, isMock: true } },
      },
    });
    if (!booking || !booking.guestEmail) return null;

    const paid = calculatePaidAmount(booking.payments);
    if (paid <= 0 || calculateRemainingBalance(booking.total, paid) > 0) return null;

    const claim = await tx.reservation.updateMany({
      where: { id: booking.id, status: "CONFIRMED", paidConfirmationEmailAttemptedAt: null },
      data: { paidConfirmationEmailAttemptedAt: new Date() },
    });
    return claim.count === 1 ? { ...booking, paid } : null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (!reservation) return false;

  const amount = new Intl.NumberFormat("en", { style: "currency", currency: reservation.currency })
    .format(reservation.paid);
  const dates = [reservation.checkInDate, reservation.checkOutDate]
    .map((date) => date.toISOString().slice(0, 10));
  const mockOnly = reservation.payments.every((payment) => payment.isMock);
  const includesMock = reservation.payments.some((payment) => payment.isMock);
  await send({
    to: reservation.guestEmail,
    subject: `${includesMock ? "[TEST] " : ""}Booking confirmed: ${reservation.reservationNumber}`,
    text: [
      "Your booking is confirmed and the balance is fully paid.",
      `Reservation: ${reservation.reservationNumber}`,
      `Hotel: ${reservation.hotel.name}`,
      `Check-in: ${dates[0]}`,
      `Check-out: ${dates[1]}`,
      `Total paid: ${amount} ${reservation.currency}`,
      ...(mockOnly ? ["This was a test payment. No real charge was made."]
        : includesMock ? ["The total includes a test payment. No real charge was made for the test portion."] : []),
    ].join("\n"),
  }, `booking-paid/${reservation.id}`, {
    hotelId: reservation.hotelId, reservationId: reservation.id,
    reservationNumber: reservation.reservationNumber, emailType: "Booking confirmation",
  });
  return true;
}
