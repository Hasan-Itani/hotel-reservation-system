import { getHotelLocalDate } from "../booking-domain/hotel-local-date";

export function canRefundReservation(
  reservation: { status: string; checkOutDate: Date; hotel: { timezone: string } },
  now = new Date(),
) {
  if (reservation.status === "CHECKED_OUT") return false;
  if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") return true;

  return reservation.checkOutDate.toISOString().slice(0, 10) >= getHotelLocalDate(now, reservation.hotel.timezone);
}
