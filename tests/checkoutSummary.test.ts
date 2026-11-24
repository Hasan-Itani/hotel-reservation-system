import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { notifyCheckoutSummary } from "../apps/api/src/admin-reservations/checkout-summary";
import type { ReservationUpdateResult } from "../apps/api/src/admin-reservations/reservation-writes";
import type { TransactionalEmail } from "../apps/api/src/common/resend-sender";

const scope = { hotelId: "fixture-hotel", reservationId: "fixture-booking" };
const checkout: ReservationUpdateResult = { status: 200, body: {}, checkoutCompleted: true };

function fixture(partiallyRefunded: boolean) {
  const queried: Array<Prisma.ReservationWhereInput | undefined> = [];
  const database = {
    reservation: { findFirst: async ({ where }: Prisma.ReservationFindFirstArgs) => {
      queried.push(where);
      return {
        id: scope.reservationId,
        reservationNumber: "RSV-CHECKOUT",
        guestEmail: "guest@example.com",
        checkInDate: new Date("2026-11-23"),
        checkOutDate: new Date("2026-11-24"),
        total: new Prisma.Decimal(200),
        currency: "USD",
        hotel: { name: "Fixture Hotel" },
        payments: [
          { amount: new Prisma.Decimal(125), status: "PAID", isMock: true },
          { amount: new Prisma.Decimal(50), status: "REFUNDED", isMock: true },
          ...(partiallyRefunded ? [{ amount: new Prisma.Decimal(20), status: "PARTIALLY_REFUNDED", isMock: true }] : []),
        ],
      };
    } },
  } as unknown as Pick<PrismaClient, "reservation">;
  return { database, queried };
}

describe("checkout summary", () => {
  it("shows the booking dates, net paid, full refunds and balance without moving money", async () => {
    const { database, queried } = fixture(false);
    const sent: Array<{ message: TransactionalEmail; key: string }> = [];
    assert.equal(await notifyCheckoutSummary(database, scope, checkout, async (message, key) => {
      sent.push({ message, key });
    }), checkout);
    assert.deepEqual(queried, [{ id: scope.reservationId, hotelId: scope.hotelId, status: "CHECKED_OUT" }]);
    assert.equal(sent.length, 1);
    const [{ message, key }] = sent;
    assert.equal(message.to, "guest@example.com");
    assert.equal(message.subject, "[TEST] Checkout summary: RSV-CHECKOUT");
    assert.equal(key, "booking-checkout/fixture-booking");
    assert.match(message.text, /Booked stay: 2026-11-23 to 2026-11-24/);
    assert.match(message.text, /Booking total: \$200\.00 USD/);
    assert.match(message.text, /Payments still applied: \$125\.00 USD/);
    assert.match(message.text, /Full refunds recorded: \$50\.00 USD/);
    assert.match(message.text, /Balance due: \$75\.00 USD/);
    assert.match(message.text, /Checkout did not create a charge/);
  });

  it("does not guess the balance when a partial refund has no recorded amount", async () => {
    const { database } = fixture(true);
    let summary = "";
    await notifyCheckoutSummary(database, scope, checkout, async (message) => { summary = message.text; });
    assert.match(summary, /Balance not available/);
    assert.doesNotMatch(summary, /Balance due:/);
  });

  it("skips unsuccessful and unrelated writes and preserves checkout when email fails", async () => {
    const { database, queried } = fixture(false);
    const messages: TransactionalEmail[] = [];
    for (const result of [{ status: 409, body: {} }, { status: 200, body: {} }]) {
      assert.equal(await notifyCheckoutSummary(database, scope, result, async (message) => { messages.push(message); }), result);
    }
    assert.equal(queried.length, 0);
    assert.equal(messages.length, 0);
    assert.equal(await notifyCheckoutSummary(database, scope, checkout, async () => {
      throw new Error("Provider error");
    }), checkout);
  });
});
