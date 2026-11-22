import { prisma } from "@/lib/prisma";
import {
  getRoomTypeAvailabilityForHotel as getAvailability,
  validateReservationRoomAvailability as validateAvailability,
} from "../apps/api/src/booking-domain/reservation-availability";

export {
  getRequestedRoomTypeCounts,
  type ReservationRoomRequest,
  type RoomTypeAvailabilityRecord,
} from "../apps/api/src/booking-domain/reservation-availability";

type WithOptionalClient<Input extends { client: unknown }> = Omit<Input, "client"> & {
  client?: Input["client"];
};

export function getRoomTypeAvailabilityForHotel(
  input: WithOptionalClient<Parameters<typeof getAvailability>[0]>,
) {
  return getAvailability({ ...input, client: input.client ?? prisma });
}

export function validateReservationRoomAvailability(
  input: WithOptionalClient<Parameters<typeof validateAvailability>[0]>,
) {
  return validateAvailability({ ...input, client: input.client ?? prisma });
}
