import { Prisma, type PrismaClient } from "@prisma/client";
import { mockPaymentCreateSchema } from "../booking-domain/public-payment-schema";
import {
  calculatePaidAmount,
  calculateRemainingBalance,
  canReservationAcceptPayment,
  getReservationStatusAfterSuccessfulPayment,
  roundMoney,
  validatePaymentAmount,
} from "../booking-domain/reservation-payments";
import { createAuditLog } from "../common/audit-log";
import type { AuthUser } from "../common/permissions";
import { requireReservationWriteAccess, writeResponse, type ReservationWriteResult } from "./reservation-write-access";
import { paymentStatusUpdateSchema } from "./payment-write-schema";

const paymentSelect = {
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
} satisfies Prisma.PaymentSelect;

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

export async function createAdminMockPayment(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  reservationId: string,
  readBody: () => Promise<unknown>,
): Promise<ReservationWriteResult> {
  const access = requireReservationWriteAccess(user, hotelId);
  if (!access.ok) return access.result;

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return writeResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = mockPaymentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return writeResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    return await database.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
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
        return writeResponse(
          { error: "Reservation not found" },
          { status: 404 },
        );
      }

      if (!canReservationAcceptPayment(reservation.status)) {
        return writeResponse(
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
        return writeResponse(
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
        return writeResponse(
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

      const paymentStatus = input.cardNumber.endsWith("0000") ? "FAILED" : "PAID";

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
        select: paymentSelect,
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

      await createAuditLog(
        {
          hotelId,
          actorUserId: access.user.id,
          action: "PAYMENT_CREATED",
          entityType: "Payment",
          entityId: payment.id,
          summary: `Payment was created for reservation ${reservation.reservationNumber}`,
          metadata: {
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            paymentStatus: payment.status,
            amount: Number(payment.amount),
            currency: payment.currency,
            provider: payment.provider,
          },
        },
        tx,
      );

      return writeResponse(
        {
          message: payment.status === "PAID"
            ? "Mock card payment processed successfully"
            : "Mock card payment failed",
          payment,
          reservation: updatedReservation,
        },
        { status: 201 },
      );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034") {
        return writeResponse(
          { error: "Payment or reservation data changed. Refresh and check the balance before trying again." },
          { status: 409 },
        );
      }
      if (error.code === "P2002") {
        return writeResponse(
          { error: "A unique constraint was violated while creating the payment" },
          { status: 409 },
        );
      }
    }

    console.error("Create payment transaction failed");
    return writeResponse({ error: "Internal server error" }, { status: 500 });
  }
}

export async function updateAdminPaymentStatus(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  reservationId: string,
  paymentId: string,
  readBody: () => Promise<unknown>,
): Promise<ReservationWriteResult> {
  const access = requireReservationWriteAccess(user, hotelId);
  if (!access.ok) return access.result;

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return writeResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paymentStatusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return writeResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { action } = parsed.data;

  try {
    return await database.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
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
        return writeResponse({ error: "Payment not found" }, { status: 404 });
      }

      if (
        action === "MARK_PAID" &&
        !["PENDING", "FAILED"].includes(payment.status)
      ) {
        return writeResponse(
          { error: "Only PENDING or FAILED payments can be marked as PAID" },
          { status: 409 },
        );
      }

      if (
        action === "MARK_FAILED" &&
        !["PENDING", "FAILED"].includes(payment.status)
      ) {
        return writeResponse(
          { error: "Only PENDING or FAILED payments can be marked as FAILED" },
          { status: 409 },
        );
      }

      if (
        action === "MARK_REFUNDED" &&
        !["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)
      ) {
        return writeResponse(
          {
            error:
              "Only PAID or PARTIALLY_REFUNDED payments can be marked as REFUNDED",
          },
          { status: 409 },
        );
      }

      if (action === "MARK_PARTIALLY_REFUNDED" && payment.status !== "PAID") {
        return writeResponse(
          { error: "Only PAID payments can be marked as PARTIALLY_REFUNDED" },
          { status: 409 },
        );
      }

      let normalizedPaymentAmount: number | null = null;
      let alreadyPaid = 0;

      if (action === "MARK_PAID") {
        if (!canReservationAcceptPayment(payment.reservation.status)) {
          return writeResponse(
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
          return writeResponse(
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
          return writeResponse(
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
        select: paymentSelect,
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

      await createAuditLog(
        {
          hotelId,
          actorUserId: access.user.id,
          action: "PAYMENT_STATUS_UPDATED",
          entityType: "Payment",
          entityId: updatedPayment.id,
          summary: `Payment status was updated for reservation ${payment.reservation.reservationNumber}`,
          metadata: {
            reservationId: payment.reservation.id,
            reservationNumber: payment.reservation.reservationNumber,
            previousStatus: payment.status,
            nextStatus: updatedPayment.status,
            action,
            amount: Number(updatedPayment.amount),
            currency: updatedPayment.currency,
          },
        },
        tx,
      );

      return writeResponse({
        message: "Payment updated successfully",
        payment: updatedPayment,
        reservation: updatedReservation,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034") {
        return writeResponse(
          { error: "Payment or reservation data changed. Refresh and check the balance before trying again." },
          { status: 409 },
        );
      }
    }

    console.error("Update payment status transaction failed");
    return writeResponse({ error: "Internal server error" }, { status: 500 });
  }
}
