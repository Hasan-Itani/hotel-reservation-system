export function canRefundReservation(
  reservation: { status: string; checkOutDate: Date; hotel: { timezone: string } },
  now = new Date(),
) {
  if (reservation.status === "CHECKED_OUT") return false;
  if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") return true;

  const hotelDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: reservation.hotel.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = hotelDate.find(({ type }) => type === "year")?.value;
  const month = hotelDate.find(({ type }) => type === "month")?.value;
  const day = hotelDate.find(({ type }) => type === "day")?.value;
  return reservation.checkOutDate.toISOString().slice(0, 10) >= `${year}-${month}-${day}`;
}
