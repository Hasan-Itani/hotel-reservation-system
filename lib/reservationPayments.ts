import { Prisma, ReservationStatus } from "@prisma/client";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/hotelInventory";
import { canTransitionReservationStatus } from "@/lib/reservationStatus";
import {
  addMoney,
  decimalToNumber,
  roundMoney,
  subtractMoney,
} from "@/lib/money";

export { decimalToNumber, roundMoney } from "@/lib/money";

type PaymentLike = {
  status: string;
  amount: Prisma.Decimal | number;
};

export function calculatePaidAmount(payments: PaymentLike[]) {
  return addMoney(
    ...payments
      .filter((payment) => payment.status === "PAID")
      .map((payment) => payment.amount),
  );
}

export function calculateRemainingBalance(
  total: Prisma.Decimal | number,
  paid: number,
) {
  return roundMoney(Math.max(subtractMoney(total, paid), 0));
}

export function canReservationAcceptPayment(status: ReservationStatus) {
  return BLOCKING_RESERVATION_STATUSES.includes(
    status as (typeof BLOCKING_RESERVATION_STATUSES)[number],
  );
}

export function validatePaymentAmount(
  amount: number,
  remainingBalance: number,
) {
  const normalizedAmount = roundMoney(amount);
  const normalizedRemainingBalance = roundMoney(remainingBalance);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return {
      ok: false as const,
      code: "INVALID_AMOUNT",
      error: "Payment amount must be greater than 0",
    };
  }

  if (normalizedAmount > normalizedRemainingBalance) {
    return {
      ok: false as const,
      code: "AMOUNT_TOO_HIGH",
      error: "Payment amount exceeds the remaining reservation balance",
    };
  }

  return {
    ok: true as const,
    amount: normalizedAmount,
  };
}

export function getReservationStatusAfterSuccessfulPayment(input: {
  currentStatus: ReservationStatus;
  total: Prisma.Decimal | number;
  paidAmountAfterPayment: number;
  confirmedAt: Date | null;
}): {
  nextStatus: ReservationStatus;
  shouldSetConfirmedAt: boolean;
} {
  const reservationTotal = roundMoney(decimalToNumber(input.total));
  const paidAmountAfterPayment = roundMoney(input.paidAmountAfterPayment);

  const shouldConfirm =
    input.currentStatus === "PENDING" &&
    canTransitionReservationStatus(input.currentStatus, "CONFIRMED") &&
    paidAmountAfterPayment >= reservationTotal;

  return {
    nextStatus: shouldConfirm ? "CONFIRMED" : input.currentStatus,
    shouldSetConfirmedAt: shouldConfirm && input.confirmedAt === null,
  };
}