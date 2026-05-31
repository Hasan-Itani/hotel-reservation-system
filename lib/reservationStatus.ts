import { ReservationStatus } from "@prisma/client";

export type ReservationStatusAction =
  | "CONFIRM"
  | "CANCEL"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "NO_SHOW";

export const RESERVATION_STATUS_TRANSITIONS: Record<
  ReservationStatus,
  readonly ReservationStatus[]
> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.CHECKED_IN,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CHECKED_IN]: [ReservationStatus.CHECKED_OUT],
  [ReservationStatus.CHECKED_OUT]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
};

export const RESERVATION_STATUS_ACTION_TARGETS = {
  CONFIRM: ReservationStatus.CONFIRMED,
  CANCEL: ReservationStatus.CANCELLED,
  CHECK_IN: ReservationStatus.CHECKED_IN,
  CHECK_OUT: ReservationStatus.CHECKED_OUT,
  NO_SHOW: ReservationStatus.NO_SHOW,
} as const satisfies Record<ReservationStatusAction, ReservationStatus>;

export function getReservationTargetStatusForAction(
  action: ReservationStatusAction,
) {
  return RESERVATION_STATUS_ACTION_TARGETS[action];
}

export function getAllowedReservationNextStatuses(status: ReservationStatus) {
  return [...RESERVATION_STATUS_TRANSITIONS[status]];
}

export function canTransitionReservationStatus(
  currentStatus: ReservationStatus,
  nextStatus: ReservationStatus,
) {
  return RESERVATION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function validateReservationStatusTransition(input: {
  currentStatus: ReservationStatus;
  nextStatus: ReservationStatus;
}) {
  const allowedStatuses = getAllowedReservationNextStatuses(input.currentStatus);

  if (input.currentStatus === input.nextStatus) {
    return {
      ok: false as const,
      error: `Reservation is already ${input.currentStatus}`,
      currentStatus: input.currentStatus,
      nextStatus: input.nextStatus,
      allowedStatuses,
    };
  }

  if (!canTransitionReservationStatus(input.currentStatus, input.nextStatus)) {
    return {
      ok: false as const,
      error: `Cannot transition reservation from ${input.currentStatus} to ${input.nextStatus}`,
      currentStatus: input.currentStatus,
      nextStatus: input.nextStatus,
      allowedStatuses,
    };
  }

  return {
    ok: true as const,
    currentStatus: input.currentStatus,
    nextStatus: input.nextStatus,
  };
}

export function validateReservationActionTransition(input: {
  currentStatus: ReservationStatus;
  action: ReservationStatusAction;
}) {
  return validateReservationStatusTransition({
    currentStatus: input.currentStatus,
    nextStatus: getReservationTargetStatusForAction(input.action),
  });
}
