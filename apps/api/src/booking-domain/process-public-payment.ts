import { PaymentProvider, PaymentStatus, Prisma, type PrismaClient, type ReservationStatus } from "@prisma/client";
import { getPartialPaymentReceipt } from "./partial-payment-receipt";
import type { PublicBookingPaymentInput } from "./public-payment-schema";
import {
  calculatePaidAmount,
  calculateRemainingBalance,
  canReservationAcceptPayment,
  getReservationStatusAfterSuccessfulPayment,
  roundMoney,
  validatePaymentAmount,
} from "./reservation-payments";

const publicPaymentSelect = {
  id: true,
  methodLabel: true,
  cardLast4: true,
  isMock: true,
  amount: true,
  currency: true,
  status: true,
  paidAt: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

type PublicPaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof publicPaymentSelect;
}>;

type PaymentSummary = {
  total: number;
  paid: number;
  remaining: number;
};

type PaymentTransactionResult =
  | { type: "NOT_FOUND" }
  | {
      type: "INVALID_STATUS";
      reservationNumber: string;
      reservationStatus: ReservationStatus;
    }
  | {
      type: "ALREADY_PAID";
      reservationNumber: string;
      reservationStatus: ReservationStatus;
      paymentSummary: PaymentSummary;
    }
  | {
      type: "INVALID_AMOUNT";
      reservationNumber: string;
      reservationStatus: ReservationStatus;
      paymentSummary: PaymentSummary;
    }
  | {
      type: "AMOUNT_TOO_HIGH";
      reservationNumber: string;
      reservationStatus: ReservationStatus;
      paymentSummary: PaymentSummary;
    }
  | {
      type: "FAILED";
      payment: PublicPaymentRecord;
      reservationNumber: string;
      reservationStatus: ReservationStatus;
      paymentSummary: PaymentSummary;
    }
  | {
      type: "SUCCESS";
      payment: PublicPaymentRecord;
      reservationNumber: string;
      reservationStatus: ReservationStatus;
      confirmedAt: Date | null;
      paymentSummary: PaymentSummary;
    };

function getMockCardMethodLabel(cardNumber: string) {
  if (/^4/.test(cardNumber)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return "MASTERCARD";
  if (/^(34|37)/.test(cardNumber)) return "AMEX";
  if (/^6/.test(cardNumber)) return "DISCOVER";
  return "CARD";
}

function shouldMockPaymentFail(cardNumber: string) {
  return cardNumber === "4000000000000002" || cardNumber.endsWith("0002");
}

function createMockProviderReference() {
  return `MOCK-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase()}`;
}

function serializePayment(payment: PublicPaymentRecord) {
  return {
    methodLabel: payment.methodLabel,
    cardLast4: payment.cardLast4,
    isMock: payment.isMock,
    amount: roundMoney(Number(payment.amount)),
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}

export async function processPublicPayment(
  database: PrismaClient,
  reservationNumber: string,
  input: PublicBookingPaymentInput,
  currentUser: { id: string } | null,
) {
  const { guestEmail, amount, cardHolderName, cardNumber } = input;
  if (!currentUser && !guestEmail) {
    return { status: 400, body: { error: "guestEmail is required unless you are signed in" } };
  }

  try {
    const result: PaymentTransactionResult = await database.$transaction(
      async (tx) => {
        const accessFilters = [
          ...(currentUser ? [{ userId: currentUser.id }] : []),
          ...(guestEmail ? [{ guestEmail }] : []),
        ];

        const reservation = await tx.reservation.findFirst({
          where: {
            reservationNumber,
            hotel: {
              deletedAt: null,
            },
            OR: accessFilters,
          },
          select: {
            id: true,
            reservationNumber: true,
            total: true,
            currency: true,
            status: true,
            confirmedAt: true,
            payments: {
              orderBy: {
                createdAt: "desc",
              },
              select: {
                id: true,
                amount: true,
                status: true,
              },
            },
          },
        });

        if (!reservation) {
          return { type: "NOT_FOUND" };
        }

        const totalAmount = roundMoney(Number(reservation.total));
        const alreadyPaid = calculatePaidAmount(reservation.payments);
        const remainingBeforePayment = calculateRemainingBalance(
          reservation.total,
          alreadyPaid,
        );

        const basePaymentSummary: PaymentSummary = {
          total: totalAmount,
          paid: alreadyPaid,
          remaining: remainingBeforePayment,
        };

        if (!canReservationAcceptPayment(reservation.status)) {
          return {
            type: "INVALID_STATUS",
            reservationNumber: reservation.reservationNumber,
            reservationStatus: reservation.status,
          };
        }

        if (remainingBeforePayment <= 0) {
          return {
            type: "ALREADY_PAID",
            reservationNumber: reservation.reservationNumber,
            reservationStatus: reservation.status,
            paymentSummary: basePaymentSummary,
          };
        }

        const requestedAmount =
          amount !== undefined ? amount : remainingBeforePayment;

        const amountValidation = validatePaymentAmount(
          requestedAmount,
          remainingBeforePayment,
        );

        if (!amountValidation.ok) {
          return {
            type:
              amountValidation.code === "INVALID_AMOUNT"
                ? "INVALID_AMOUNT"
                : "AMOUNT_TOO_HIGH",
            reservationNumber: reservation.reservationNumber,
            reservationStatus: reservation.status,
            paymentSummary: basePaymentSummary,
          };
        }

        const chargeAmount = amountValidation.amount;
        const willFail = shouldMockPaymentFail(cardNumber);
        const methodLabel = getMockCardMethodLabel(cardNumber);
        const now = new Date();

        const payment = await tx.payment.create({
          data: {
            reservationId: reservation.id,
            provider: PaymentProvider.MOCK_CARD,
            providerReference: createMockProviderReference(),
            methodLabel,
            cardLast4: cardNumber.slice(-4),
            cardHolderName,
            isMock: true,
            amount: chargeAmount,
            currency: reservation.currency,
            status: willFail ? PaymentStatus.FAILED : PaymentStatus.PAID,
            paidAt: willFail ? null : now,
          },
          select: publicPaymentSelect,
        });

        if (willFail) {
          return {
            type: "FAILED",
            payment,
            reservationNumber: reservation.reservationNumber,
            reservationStatus: reservation.status,
            paymentSummary: basePaymentSummary,
          };
        }

        const paidAmountAfterPayment = roundMoney(alreadyPaid + chargeAmount);
        const remainingAfterPayment = calculateRemainingBalance(
          reservation.total,
          paidAmountAfterPayment,
        );

        const paymentEffect = getReservationStatusAfterSuccessfulPayment({
          currentStatus: reservation.status,
          total: reservation.total,
          paidAmountAfterPayment,
          confirmedAt: reservation.confirmedAt,
        });

        let reservationStatus = reservation.status;
        let confirmedAt = reservation.confirmedAt;

        if (
          paymentEffect.nextStatus !== reservation.status ||
          paymentEffect.shouldSetConfirmedAt
        ) {
          const updatedReservation = await tx.reservation.update({
            where: {
              id: reservation.id,
            },
            data: {
              status: paymentEffect.nextStatus,
              confirmedAt: paymentEffect.shouldSetConfirmedAt
                ? now
                : reservation.confirmedAt,
            },
            select: {
              status: true,
              confirmedAt: true,
            },
          });

          reservationStatus = updatedReservation.status;
          confirmedAt = updatedReservation.confirmedAt;
        }

        return {
          type: "SUCCESS",
          payment,
          reservationNumber: reservation.reservationNumber,
          reservationStatus,
          confirmedAt,
          paymentSummary: {
            total: totalAmount,
            paid: paidAmountAfterPayment,
            remaining: remainingAfterPayment,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    switch (result.type) {
      case "NOT_FOUND":
        return { status: 404, body: { error: "Booking not found" } };

      case "INVALID_STATUS":
        return { status: 409, body: {
          error: `Payments are not allowed for reservation status ${result.reservationStatus}`,
          reservationNumber: result.reservationNumber,
          reservationStatus: result.reservationStatus,
        } };

      case "ALREADY_PAID":
        return { status: 409, body: {
          error: "This booking is already fully paid",
          reservationNumber: result.reservationNumber,
          reservationStatus: result.reservationStatus,
          paymentSummary: result.paymentSummary,
        } };

      case "INVALID_AMOUNT":
        return { status: 400, body: {
          error: "Payment amount must be greater than 0",
          reservationNumber: result.reservationNumber,
          reservationStatus: result.reservationStatus,
          paymentSummary: result.paymentSummary,
        } };

      case "AMOUNT_TOO_HIGH":
        return { status: 409, body: {
          error:
            "Payment amount cannot be greater than the remaining balance",
          reservationNumber: result.reservationNumber,
          reservationStatus: result.reservationStatus,
          paymentSummary: result.paymentSummary,
          remainingBalance: result.paymentSummary.remaining,
        } };

      case "FAILED":
        return { status: 201, body: {
          message: "Mock card payment failed",
          payment: serializePayment(result.payment),
          reservationNumber: result.reservationNumber,
          reservationStatus: result.reservationStatus,
          paymentSummary: result.paymentSummary,
        } };

      case "SUCCESS":
        return { status: 201, partialPaymentReceipt: getPartialPaymentReceipt(result.payment, result.paymentSummary.remaining), body: {
          message: "Mock card payment processed successfully",
          payment: serializePayment(result.payment),
          reservationNumber: result.reservationNumber,
          reservationStatus: result.reservationStatus,
          confirmedAt: result.confirmedAt,
          paymentSummary: result.paymentSummary,
        } };
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { status: 409, body: { error: "The booking balance changed. Refresh and check your balance before trying again." } };
    }

    console.error("Public booking payment transaction failed");
    return { status: 500, body: { error: "Failed to process payment" } };
  }
}
