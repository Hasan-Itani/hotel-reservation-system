export function getHotelLocalDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find(({ type }) => type === "year")?.value;
  const month = parts.find(({ type }) => type === "month")?.value;
  const day = parts.find(({ type }) => type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function hasReachedCheckInDate(checkInDate: Date, timezone: string, now = new Date()) {
  return checkInDate.toISOString().slice(0, 10) <= getHotelLocalDate(now, timezone);
}
