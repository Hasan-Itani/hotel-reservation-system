import { ReservationStatus, RoomStatus } from "@prisma/client";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/hotelInventory";

export const MANUALLY_MANAGEABLE_ROOM_STATUSES = [
  RoomStatus.AVAILABLE,
  RoomStatus.MAINTENANCE,
  RoomStatus.OUT_OF_SERVICE,
  RoomStatus.CLEANING,
] as const;

export const SYSTEM_MANAGED_ROOM_STATUSES = [RoomStatus.OCCUPIED] as const;

export type ActiveRoomAssignment = {
  reservation: {
    id: string;
    reservationNumber: string;
    status: ReservationStatus;
  };
} | null;

export function isBlockingReservationStatus(status: ReservationStatus) {
  return BLOCKING_RESERVATION_STATUSES.includes(
    status as (typeof BLOCKING_RESERVATION_STATUSES)[number],
  );
}

export function isSystemManagedRoomStatus(status: RoomStatus) {
  return SYSTEM_MANAGED_ROOM_STATUSES.includes(
    status as (typeof SYSTEM_MANAGED_ROOM_STATUSES)[number],
  );
}

export function validateRoomCreateStatus(status: RoomStatus) {
  if (status === RoomStatus.OCCUPIED) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error:
          "Rooms cannot be created as OCCUPIED. OCCUPIED is managed by reservation check-in/check-out",
      },
    };
  }

  return {
    ok: true as const,
  };
}

export function validateManualRoomStatusChange(input: {
  currentStatus: RoomStatus;
  nextStatus: RoomStatus;
  activeAssignment: ActiveRoomAssignment;
}) {
  if (input.currentStatus === input.nextStatus) {
    return {
      ok: true as const,
    };
  }

  if (input.nextStatus === RoomStatus.OCCUPIED) {
    return {
      ok: false as const,
      status: 409,
      body: {
        error:
          "Cannot manually set a room to OCCUPIED. OCCUPIED is managed by reservation check-in",
        currentStatus: input.currentStatus,
        nextStatus: input.nextStatus,
      },
    };
  }

  if (input.activeAssignment) {
    return {
      ok: false as const,
      status: 409,
      body: {
        error:
          "Cannot manually change room status while the room is assigned to an active reservation",
        currentStatus: input.currentStatus,
        nextStatus: input.nextStatus,
        reservationId: input.activeAssignment.reservation.id,
        reservationNumber: input.activeAssignment.reservation.reservationNumber,
        reservationStatus: input.activeAssignment.reservation.status,
      },
    };
  }

  return {
    ok: true as const,
  };
}

export function validateProtectedRoomFieldChange(input: {
  currentStatus: RoomStatus;
  activeAssignment: ActiveRoomAssignment;
}) {
  if (input.activeAssignment) {
    return {
      ok: false as const,
      status: 409,
      body: {
        error:
          "Cannot change room type or room number while the room is assigned to an active reservation",
        reservationId: input.activeAssignment.reservation.id,
        reservationNumber: input.activeAssignment.reservation.reservationNumber,
        reservationStatus: input.activeAssignment.reservation.status,
      },
    };
  }

  if (input.currentStatus === RoomStatus.OCCUPIED) {
    return {
      ok: false as const,
      status: 409,
      body: {
        error:
          "Cannot change room type or room number while the room is OCCUPIED",
        currentStatus: input.currentStatus,
      },
    };
  }

  return {
    ok: true as const,
  };
}