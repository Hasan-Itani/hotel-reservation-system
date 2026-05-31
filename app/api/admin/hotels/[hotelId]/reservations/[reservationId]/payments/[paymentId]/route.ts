import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { hasGlobalRole, hasHotelRole, type AuthUser } from "@/lib/permissions";
import { paymentStatusUpdateSchema } from "@/lib/validators";
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

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      hotelId: string;
      reservationId: string;
      paymentId: string;
    }>;
  },
) {
  const { hotelId, reservationId, paymentId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      reservationId,
      reservation: {
        hotelId,
      },
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
      reservation: {
        select: {
          id: true,
          reservationNumber: true,
          status: true,
          total: true,
          currency: true,
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json({ payment });
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      hotelId: string;
      reservationId: string;
      paymentId: string;
    }>;
  },
) {
  const { hotelId, reservationId, paymentId } = await params;

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

  const parsed = paymentStatusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { action } = parsed.data;

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      reservationId,
      reservation: {
        hotelId,
      },
    },
    select: {
      id: true,
      reservationId: true,
      status: true,
      amount: true,
      currency: true,
      paidAt: true,
      reservation: {
        select: {
          id: true,
          reservationNumber: true,
          status: true,
          total: true,
          currency: true,
          confirmedAt: true,
          payments: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (
    action === "MARK_PAID" &&
    !["PENDING", "FAILED"].includes(payment.status)
  ) {
    return NextResponse.json(
      { error: "Only PENDING or FAILED payments can be marked as PAID" },
      { status: 409 },
    );
  }

  if (
    action === "MARK_FAILED" &&
    !["PENDING", "FAILED"].includes(payment.status)
  ) {
    return NextResponse.json(
      { error: "Only PENDING or FAILED payments can be marked as FAILED" },
      { status: 409 },
    );
  }

  if (
    action === "MARK_REFUNDED" &&
    !["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)
  ) {
    return NextResponse.json(
      {
        error:
          "Only PAID or PARTIALLY_REFUNDED payments can be marked as REFUNDED",
      },
      { status: 409 },
    );
  }

  if (action === "MARK_PARTIALLY_REFUNDED" && payment.status !== "PAID") {
    return NextResponse.json(
      { error: "Only PAID payments can be marked as PARTIALLY_REFUNDED" },
      { status: 409 },
    );
  }

  let normalizedPaymentAmount: number | null = null;
  let alreadyPaid = 0;

  if (action === "MARK_PAID") {
    if (!canReservationAcceptPayment(payment.reservation.status)) {
      return NextResponse.json(
        {
          error: "This reservation status does not allow accepting payment",
          reservationId: payment.reservation.id,
          reservationNumber: payment.reservation.reservationNumber,
          reservationStatus: payment.reservation.status,
          paymentId: payment.id,
        },
        { status: 409 },
      );
    }

    alreadyPaid = calculatePaidAmount(
      payment.reservation.payments.filter(
        (existingPayment) => existingPayment.id !== payment.id,
      ),
    );

    const remainingBalance = calculateRemainingBalance(
      payment.reservation.total,
      alreadyPaid,
    );

    if (remainingBalance <= 0) {
      return NextResponse.json(
        {
          error: "Reservation is already fully paid",
          code: "ALREADY_PAID",
          reservationId: payment.reservation.id,
          reservationNumber: payment.reservation.reservationNumber,
          remainingBalance,
        },
        { status: 409 },
      );
    }

    const amountValidation = validatePaymentAmount(
      Number(payment.amount),
      remainingBalance,
    );

    if (!amountValidation.ok) {
      return NextResponse.json(
        {
          error: amountValidation.error,
          code: amountValidation.code,
          reservationId: payment.reservation.id,
          reservationNumber: payment.reservation.reservationNumber,
          remainingBalance,
        },
        {
          status: amountValidation.code === "INVALID_AMOUNT" ? 400 : 409,
        },
      );
    }

    normalizedPaymentAmount = amountValidation.amount;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status:
            action === "MARK_PAID"
              ? "PAID"
              : action === "MARK_FAILED"
                ? "FAILED"
                : action === "MARK_REFUNDED"
                  ? "REFUNDED"
                  : "PARTIALLY_REFUNDED",
          paidAt: action === "MARK_PAID" ? new Date() : payment.paidAt,
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

      if (action === "MARK_PAID" && normalizedPaymentAmount !== null) {
        const paidAmountAfterPayment = roundMoney(
          alreadyPaid + normalizedPaymentAmount,
        );

        const paymentEffect = getReservationStatusAfterSuccessfulPayment({
          currentStatus: payment.reservation.status,
          total: payment.reservation.total,
          paidAmountAfterPayment,
          confirmedAt: payment.reservation.confirmedAt,
        });

        if (
          paymentEffect.nextStatus !== payment.reservation.status ||
          paymentEffect.shouldSetConfirmedAt
        ) {
          await tx.reservation.update({
            where: {
              id: payment.reservation.id,
            },
            data: {
              status: paymentEffect.nextStatus,
              confirmedAt: paymentEffect.shouldSetConfirmedAt
                ? new Date()
                : payment.reservation.confirmedAt,
            },
          });
        }
      }

      const updatedReservation = await tx.reservation.findFirst({
        where: {
          id: payment.reservation.id,
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
        payment: updatedPayment,
        reservation: updatedReservation,
      };
    });

    return NextResponse.json({
      message: "Payment updated successfully",
      ...result,
    });
  } catch (error) {
    console.error("Update payment status error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
