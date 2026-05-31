import { ReservationStatus, RoomStatus } from "@prisma/client";

export const BLOCKING_RESERVATION_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
] as const;

export const SELLABLE_ROOM_STATUSES = [
  RoomStatus.AVAILABLE,
  RoomStatus.OCCUPIED,
  RoomStatus.CLEANING,
] as const;

export function parseDateOnlyToUtc(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function getNightCount(checkInDate: string, checkOutDate: string) {
  const checkIn = parseDateOnlyToUtc(checkInDate).getTime();
  const checkOut = parseDateOnlyToUtc(checkOutDate).getTime();

  return Math.floor((checkOut - checkIn) / (1000 * 60 * 60 * 24));
}

export function generateReservationNumber() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `RSV-${y}${m}${d}-${randomPart}`;
}
