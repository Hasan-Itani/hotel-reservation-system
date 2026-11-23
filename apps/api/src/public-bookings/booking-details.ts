import type { PrismaClient } from "@prisma/client";
import { publicBookingAccessQuerySchema } from "../booking-domain/public-payment-schema";
import { publicBookingSelect, serializePublicBooking } from "./public-booking-serializer";

export function bookingDetailsRateLimit(ip: string) {
  return { key: `booking-details:${ip}`, windowMs: 10 * 60 * 1000, maxRequests: 10 };
}

export async function readBookingDetails(
  database: Pick<PrismaClient, "reservation">,
  reservationNumber: string,
  userId: string | undefined,
  rawGuestEmail: string | null,
) {
  let guestEmail: string | undefined;
  if (rawGuestEmail) {
    const parsed = publicBookingAccessQuerySchema.safeParse({ guestEmail: rawGuestEmail });
    if (!parsed.success) {
      return { status: 400, body: { error: "Invalid guest email", details: parsed.error.flatten() } };
    }
    guestEmail = parsed.data.guestEmail;
  }
  if (!userId && !guestEmail) {
    return { status: 400, body: { error: "guestEmail is required unless you are signed in" } };
  }

  try {
    const reservation = await database.reservation.findFirst({
      where: {
        reservationNumber,
        hotel: { deletedAt: null },
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(guestEmail ? [{ guestEmail }] : []),
        ],
      },
      select: publicBookingSelect,
    });

    if (!reservation) {
      return { status: 404, body: { error: "Booking not found" } };
    }
    return { status: 200, body: { booking: serializePublicBooking(reservation) } };
  } catch {
    return { status: 500, body: { error: "Failed to fetch booking" } };
  }
}
