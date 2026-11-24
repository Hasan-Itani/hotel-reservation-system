import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  isPaidPaymentResponse,
  sendPaidBookingConfirmation,
} from "../apps/api/src/booking-domain/paid-confirmation-email";

const reservation = {
  id: "booking-test",
  reservationNumber: "RSV-TEST-123",
  guestEmail: "guest@example.com",
  checkInDate: new Date("2026-12-01"),
  checkOutDate: new Date("2026-12-03"),
  total: new Prisma.Decimal(100),
  currency: "USD",
  hotel: { name: "Test Hotel" },
};

function fixture(amount: number, confirmed = true) {
  let claimed = false;
  const tx = {
    reservation: {
      findUnique: async ({ where }: Prisma.ReservationFindUniqueArgs) => {
        assert.equal(where.status, "CONFIRMED");
        assert.equal(where.paidConfirmationEmailAttemptedAt, null);
        return confirmed && !claimed
          ? { ...reservation, payments: [{ amount: new Prisma.Decimal(amount), status: "PAID", isMock: true }] }
          : null;
      },
      updateMany: async ({ where }: Prisma.ReservationUpdateManyArgs) => {
        assert.deepEqual(where, {
          id: reservation.id, status: "CONFIRMED", paidConfirmationEmailAttemptedAt: null,
        });
        if (claimed) return { count: 0 };
        claimed = true;
        return { count: 1 };
      },
    },
  };
  return {
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

describe("paid booking confirmation email", () => {
  it("only considers successful responses with a paid payment", () => {
    for (const status of ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "PENDING"]) {
      assert.equal(isPaidPaymentResponse({ status: 200, body: { payment: { status } } }), false);
    }
    assert.equal(isPaidPaymentResponse({ status: 409, body: {} }), false);
    assert.equal(isPaidPaymentResponse({ status: 201, body: { payment: { status: "PAID" } } }), true);
  });

  it("skips partial payments and unconfirmed reservations", async () => {
    for (const database of [fixture(60), fixture(100, false)]) {
      const sent = await sendPaidBookingConfirmation(database, { id: reservation.id }, async () => {
        assert.fail("No email should be sent");
      });
      assert.equal(sent, false);
    }
  });

  it("claims a confirmed full payment once, including concurrent calls", async () => {
    const database = fixture(100);
    const attempts = await Promise.all([
      sendPaidBookingConfirmation(database, { id: reservation.id }, checkMessage),
      sendPaidBookingConfirmation(database, { reservationNumber: reservation.reservationNumber }, checkMessage),
    ]);
    assert.deepEqual(attempts.sort(), [false, true]);
  });

  it("does not automatically resend when delivery may have succeeded before a timeout", async () => {
    const database = fixture(100);
    await assert.rejects(
      sendPaidBookingConfirmation(database, { id: reservation.id }, async () => { throw new Error("timeout"); }),
      /timeout/,
    );
    assert.equal(await sendPaidBookingConfirmation(database, { id: reservation.id }, async () => {
      assert.fail("Do not submit a second message after an ambiguous failure");
    }), false);
  });
});

async function checkMessage(message: { to: string; subject: string; text: string }, key: string) {
  assert.equal(message.to, reservation.guestEmail);
  assert.equal(key, `booking-paid/${reservation.id}`);
  assert.match(message.subject, /^\[TEST\] Booking confirmed/);
  assert.match(message.text, /Test Hotel/);
  assert.match(message.text, /2026-12-01/);
  assert.match(message.text, /\$100\.00 USD/);
  assert.match(message.text, /No real charge was made/);
}
