import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { SendTransactionalEmail } from "../common/resend-sender";
import type { ReservationUpdateResult } from "./reservation-writes";

const logger = new Logger("CancellationEmail");

export async function notifyCancellation(
  database: Pick<PrismaClient, "reservation">,
  scope: { hotelId: string; reservationId: string },
  result: ReservationUpdateResult,
  send: SendTransactionalEmail | null,
) {
  if (!send || !result.cancellationCompleted || result.status !== 200) return result;

  try {
    const booking = await database.reservation.findFirst({
      where: { id: scope.reservationId, hotelId: scope.hotelId, status: "CANCELLED" },
      select: {
        id: true,
        reservationNumber: true,
        guestEmail: true,
        checkInDate: true,
        checkOutDate: true,
        hotel: { select: { name: true } },
      },
    });
    if (!booking?.guestEmail) return result;

    await send({
      to: booking.guestEmail,
      subject: `Reservation cancelled: ${booking.reservationNumber}`,
      text: [
        "Your reservation has been cancelled.",
        `Reservation: ${booking.reservationNumber}`,
        `Hotel: ${booking.hotel.name}`,
        `Booked stay: ${booking.checkInDate.toISOString().slice(0, 10)} to ${booking.checkOutDate.toISOString().slice(0, 10)}`,
        "This cancellation did not issue a refund. Contact the hotel if you have questions about a payment.",
      ].join("\n"),
    }, `booking-cancelled/${booking.id}`, {
      ...scope, reservationNumber: booking.reservationNumber, emailType: "Cancellation notice",
    });
  } catch {
    logger.warn("Unable to send the cancellation email. The reservation was already cancelled.");
  }

  return result;
}
