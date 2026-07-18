import { NextResponse } from "next/server";
import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  publicBookingPaymentSchema,
  publicBookingReservationParamSchema,
} from "@/lib/validators";
import { getClientIp } from "@/lib/getClientIp";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  calculatePaidAmount,
  calculateRemainingBalance,
  canReservationAcceptPayment,
  getReservationStatusAfterSuccessfulPayment,
  roundMoney,
  validatePaymentAmount,
} from "@/lib/reservationPayments";
import { getCurrentAuthUser } from "@/lib/auth";

const publicPaymentSelect = Prisma.validator<Prisma.PaymentSelect>()({
  methodLabel: true,
  cardLast4: true,
  isMock: true,
  amount: true,
  currency: true,
  status: true,
  paidAt: true,
  createdAt: true,
});

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

export async function POST(
  request: Request,
  context: { params: Promise<{ reservationNumber: string }> },
) {
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `booking-pay:${ip}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many payment attempts. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limiter.retryAfterSeconds),
          ...rateLimitHeaders(limiter),
        },
      },
    );
  }

  const routeParams = await context.params;

  const parsedParams =
    publicBookingReservationParamSchema.safeParse(routeParams);

  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid reservation number",
        details: parsedParams.error.flatten(),
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const body = await request.json().catch(() => null);

  const parsedBody = publicBookingPaymentSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid payment data",
        details: parsedBody.error.flatten(),
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const { reservationNumber } = parsedParams.data;
  const currentUser = await getCurrentAuthUser();

  const { guestEmail, amount, cardHolderName, cardNumber } = parsedBody.data;

  if (!currentUser && !guestEmail) {
    return NextResponse.json(
      {
        error: "guestEmail is required unless you are signed in",
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  try {
    const result: PaymentTransactionResult = await prisma.$transaction(
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
    );

    switch (result.type) {
      case "NOT_FOUND":
        return NextResponse.json(
          { error: "Booking not found" },
          {
            status: 404,
            headers: rateLimitHeaders(limiter),
          },
        );

      case "INVALID_STATUS":
        return NextResponse.json(
          {
            error: `Payments are not allowed for reservation status ${result.reservationStatus}`,
            reservationNumber: result.reservationNumber,
            reservationStatus: result.reservationStatus,
          },
          {
            status: 409,
            headers: rateLimitHeaders(limiter),
          },
        );

      case "ALREADY_PAID":
        return NextResponse.json(
          {
            error: "This booking is already fully paid",
            reservationNumber: result.reservationNumber,
            reservationStatus: result.reservationStatus,
            paymentSummary: result.paymentSummary,
          },
          {
            status: 409,
            headers: rateLimitHeaders(limiter),
          },
        );

      case "INVALID_AMOUNT":
        return NextResponse.json(
          {
            error: "Payment amount must be greater than 0",
            reservationNumber: result.reservationNumber,
            reservationStatus: result.reservationStatus,
            paymentSummary: result.paymentSummary,
          },
          {
            status: 400,
            headers: rateLimitHeaders(limiter),
          },
        );

      case "AMOUNT_TOO_HIGH":
        return NextResponse.json(
          {
            error:
              "Payment amount cannot be greater than the remaining balance",
            reservationNumber: result.reservationNumber,
            reservationStatus: result.reservationStatus,
            paymentSummary: result.paymentSummary,
            remainingBalance: result.paymentSummary.remaining,
          },
          {
            status: 409,
            headers: rateLimitHeaders(limiter),
          },
        );

      case "FAILED":
        return NextResponse.json(
          {
            message: "Mock card payment failed",
            payment: serializePayment(result.payment),
            reservationNumber: result.reservationNumber,
            reservationStatus: result.reservationStatus,
            paymentSummary: result.paymentSummary,
          },
          {
            status: 201,
            headers: rateLimitHeaders(limiter),
          },
        );

      case "SUCCESS":
        return NextResponse.json(
          {
            message: "Mock card payment processed successfully",
            payment: serializePayment(result.payment),
            reservationNumber: result.reservationNumber,
            reservationStatus: result.reservationStatus,
            confirmedAt: result.confirmedAt,
            paymentSummary: result.paymentSummary,
          },
          {
            status: 201,
            headers: rateLimitHeaders(limiter),
          },
        );
    }
  } catch (error) {
    console.error("Public booking payment error:", error);

    return NextResponse.json(
      { error: "Failed to process payment" },
      {
        status: 500,
        headers: rateLimitHeaders(limiter),
      },
    );
  }
}
