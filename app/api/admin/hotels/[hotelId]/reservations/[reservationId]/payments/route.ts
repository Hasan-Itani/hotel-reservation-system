import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { hasGlobalRole, hasHotelRole, type AuthUser } from "@/lib/permissions";
import { mockPaymentCreateSchema } from "@/lib/validators";
import {
  calculatePaidAmount,
  calculateRemainingBalance,
  canReservationAcceptPayment,
  getReservationStatusAfterSuccessfulPayment,
  roundMoney,
  validatePaymentAmount,
} from "@/lib/reservationPayments";

export const dynamic = "force-dynamic";

function canManagePayments(user: AuthUser, hotelId: string) {
  return (
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER") ||
    hasHotelRole(user, hotelId, "RECEPTIONIST")
  );
}

function detectCardBrand(cardNumber: string) {
  if (/^4/.test(cardNumber)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return "MASTERCARD";
  if (/^(34|37)/.test(cardNumber)) return "AMEX";
  return "OTHER";
}

function createMockReference() {
  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MOCK-${Date.now()}-${randomPart}`;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; reservationId: string }>;
  },
) {
  const { hotelId, reservationId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      hotelId,
    },
    select: {
      id: true,
      reservationNumber: true,
      status: true,
      total: true,
      currency: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      payments: {
        select: {
          id: true,
          reservationId: true,
          provider: true,
          providerReference: true,
          methodLabel: true,
          cardLast4: true,
          cardHolderName: true,
          isMock: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!reservation) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ reservation });
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; reservationId: string }>;
  },
) {
  const { hotelId, reservationId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  if (!canManagePayments(auth.user, hotelId)) {
    return NextResponse.json(
      {
        error:
          "Requires HOTEL_ADMIN, MANAGER, or RECEPTIONIST role for this hotel",
      },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = mockPaymentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      hotelId,
    },
    select: {
      id: true,
      reservationNumber: true,
      status: true,
      total: true,
      currency: true,
      confirmedAt: true,
      payments: {
        select: {
          status: true,
          amount: true,
        },
      },
    },
  });

  if (!reservation) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  if (!canReservationAcceptPayment(reservation.status)) {
    return NextResponse.json(
      {
        error: "This reservation status does not allow accepting payment",
        reservationId: reservation.id,
        reservationNumber: reservation.reservationNumber,
        reservationStatus: reservation.status,
      },
      { status: 409 },
    );
  }

  const alreadyPaid = calculatePaidAmount(reservation.payments);
  const remainingBalance = calculateRemainingBalance(
    reservation.total,
    alreadyPaid,
  );

  if (remainingBalance <= 0) {
    return NextResponse.json(
      {
        error: "Reservation is already fully paid",
        code: "ALREADY_PAID",
        reservationId: reservation.id,
        reservationNumber: reservation.reservationNumber,
        remainingBalance,
      },
      { status: 409 },
    );
  }

  const requestedAmount =
    input.amount !== undefined ? input.amount : remainingBalance;

  const amountValidation = validatePaymentAmount(
    requestedAmount,
    remainingBalance,
  );

  if (!amountValidation.ok) {
    return NextResponse.json(
      {
        error: amountValidation.error,
        code: amountValidation.code,
        reservationId: reservation.id,
        reservationNumber: reservation.reservationNumber,
        remainingBalance,
      },
      {
        status: amountValidation.code === "INVALID_AMOUNT" ? 400 : 409,
      },
    );
  }

  const amount = amountValidation.amount;
  const cardBrand = detectCardBrand(input.cardNumber);
  const last4 = input.cardNumber.slice(-4);

  // Mock rule:
  // valid-looking cards succeed unless they end with 0000
  const paymentStatus = input.cardNumber.endsWith("0000") ? "FAILED" : "PAID";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          reservationId: reservation.id,
          provider: "MOCK_CARD",
          providerReference: createMockReference(),
          methodLabel: cardBrand,
          cardLast4: last4,
          cardHolderName: input.cardHolderName,
          isMock: true,
          amount,
          currency: reservation.currency,
          status: paymentStatus,
          paidAt: paymentStatus === "PAID" ? new Date() : null,
        },
        select: {
          id: true,
          reservationId: true,
          provider: true,
          providerReference: true,
          methodLabel: true,
          cardLast4: true,
          cardHolderName: true,
          isMock: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (payment.status === "PAID") {
        const paidAmountAfterPayment = roundMoney(alreadyPaid + amount);

        const paymentEffect = getReservationStatusAfterSuccessfulPayment({
          currentStatus: reservation.status,
          total: reservation.total,
          paidAmountAfterPayment,
          confirmedAt: reservation.confirmedAt,
        });

        if (
          paymentEffect.nextStatus !== reservation.status ||
          paymentEffect.shouldSetConfirmedAt
        ) {
          await tx.reservation.update({
            where: {
              id: reservation.id,
            },
            data: {
              status: paymentEffect.nextStatus,
              confirmedAt: paymentEffect.shouldSetConfirmedAt
                ? new Date()
                : reservation.confirmedAt,
            },
          });
        }
      }

      const updatedReservation = await tx.reservation.findFirst({
        where: {
          id: reservation.id,
          hotelId,
        },
        select: {
          id: true,
          reservationNumber: true,
          status: true,
          total: true,
          currency: true,
        },
      });

      return {
        payment,
        reservation: updatedReservation,
      };
    });

    return NextResponse.json(
      {
        message:
          result.payment.status === "PAID"
            ? "Mock card payment processed successfully"
            : "Mock card payment failed",
        payment: result.payment,
        reservation: result.reservation,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "A unique constraint was violated while creating the payment",
        },
        { status: 409 },
      );
    }

    console.error("Create payment error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}