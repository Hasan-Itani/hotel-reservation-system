import type { PrismaClient } from "@prisma/client";
import { availabilityQuerySchema } from "../booking-domain/availability-query";
import { getRoomTypeAvailabilityForHotel } from "../booking-domain/reservation-availability";
import { canAccessHotel, type AuthUser } from "../common/permissions";

export async function getAdminAvailability(
  database: Pick<PrismaClient, "hotel" | "roomType" | "reservationRoom">,
  user: AuthUser | null,
  hotelId: string,
  query: URLSearchParams,
) {
  if (!user) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  if (!canAccessHotel(user, hotelId)) {
    return { status: 403, body: { error: "You do not have access to this hotel" } };
  }

  const parsed = availabilityQuerySchema.safeParse({
    checkInDate: query.get("checkInDate"),
    checkOutDate: query.get("checkOutDate"),
    adults: query.get("adults") ?? undefined,
    children: query.get("children") ?? undefined,
  });
  if (!parsed.success) {
    return { status: 400, body: { error: "Validation failed", details: parsed.error.flatten() } };
  }

  const hotel = await database.hotel.findFirst({
    where: { id: hotelId, deletedAt: null },
    select: { id: true, name: true, currency: true },
  });
  if (!hotel) {
    return { status: 404, body: { error: "Hotel not found" } };
  }

  const { availability } = await getRoomTypeAvailabilityForHotel({ ...parsed.data, hotelId, client: database });
  return {
    status: 200,
    body: {
      hotelId: hotel.id,
      hotelName: hotel.name,
      currency: hotel.currency,
      checkInDate: parsed.data.checkInDate,
      checkOutDate: parsed.data.checkOutDate,
      roomTypes: availability,
    },
  };
}
