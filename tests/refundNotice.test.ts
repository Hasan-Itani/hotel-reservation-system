import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { notifyMockRefund } from "../apps/api/src/admin-reservations/refund-notice";
import type { TransactionalEmail } from "../apps/api/src/common/resend-sender";

const scope = { hotelId: "hotel-test", reservationId: "reservation-test", paymentId: "payment-test" };
const refunded = { status: 200, body: { payment: { status: "REFUNDED" } } };
const payment = {
  id: scope.paymentId,
  amount: new Prisma.Decimal("37.50"),
  currency: "USD",
  reservation: {
    reservationNumber: "RSV-REFUND-TEST",
    guestEmail: "guest@example.com",
    hotel: { name: "Test Hotel" },
  },
};

describe("mock refund notices", () => {
  it("emails the booked guest with the payment amount and a stable idempotency key", async () => {
    const database = {
      payment: { findFirst: async ({ where }: Prisma.PaymentFindFirstArgs) => {
        assert.deepEqual(where, {
          id: scope.paymentId, reservationId: scope.reservationId, reservation: { hotelId: scope.hotelId },
          status: "REFUNDED", isMock: true,
        });
        return payment;
      } },
    } as unknown as Pick<PrismaClient, "payment">;
    const sent: Array<{ message: TransactionalEmail; key: string }> = [];
    const result = await notifyMockRefund(database, scope, refunded, async (message, key) => {
      sent.push({ message, key });
    });
    assert.equal(result, refunded);
    assert.equal(sent.length, 1);
    const [{ message, key }] = sent;
    assert.equal(message.to, payment.reservation.guestEmail);
    assert.equal(message.subject, "[TEST] Refund recorded: RSV-REFUND-TEST");
    assert.match(message.text, /\$37\.50 USD/);
    assert.match(message.text, /No real money was returned/);
    assert.match(message.text, /does not cancel/);
    assert.equal(key, "booking-refund/payment-test");
  });

  it("does not email for partial refunds, duplicate refund conflicts, or non-mock payments", async () => {
    const partial = { status: 200, body: { payment: { status: "PARTIALLY_REFUNDED" } } };
    const conflict = { status: 409, body: { error: "Already refunded" } };
    const database = {} as Pick<PrismaClient, "payment">;
    const noSend = async () => { assert.fail("Unexpected refund notice"); };
    assert.equal(await notifyMockRefund(database, scope, partial, noSend), partial);
    assert.equal(await notifyMockRefund(database, scope, conflict, noSend), conflict);
    assert.equal(await notifyMockRefund(database, scope, refunded, null), refunded);
    const noMatchingMock = { payment: { findFirst: async () => null } } as unknown as Pick<PrismaClient, "payment">;
    assert.equal(await notifyMockRefund(noMatchingMock, scope, refunded, noSend), refunded);
  });

  it("returns the committed refund result when the email provider fails", async () => {
    const database = { payment: { findFirst: async () => payment } } as unknown as Pick<PrismaClient, "payment">;
    assert.equal(await notifyMockRefund(database, scope, refunded, async () => {
      throw new Error("Mail provider unavailable");
    }), refunded);
  });
});
