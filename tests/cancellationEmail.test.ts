import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { notifyCancellation } from "../apps/api/src/admin-reservations/cancellation-email";
import type { ReservationUpdateResult } from "../apps/api/src/admin-reservations/reservation-writes";
import type { TransactionalEmail } from "../apps/api/src/common/resend-sender";

const scope = { hotelId: "hotel-test", reservationId: "booking-test" };
const cancelled: ReservationUpdateResult = {
  status: 200, cancellationCompleted: true, body: { reservation: { cancellationReason: "Private note" } },
};

function fixture() {
  const queries: Prisma.ReservationFindFirstArgs[] = [];
  const database = {
    reservation: { findFirst: async (query: Prisma.ReservationFindFirstArgs) => {
      queries.push(query);
      return {
        id: scope.reservationId, reservationNumber: "RSV-CANCEL", guestEmail: "guest@example.com",
        checkInDate: new Date("2026-12-01"), checkOutDate: new Date("2026-12-03"),
        hotel: { name: "Fixture Hotel" },
      };
    } },
  } as unknown as Pick<PrismaClient, "reservation">;
  return { database, queries };
}

describe("cancellation email", () => {
  it("sends only booking details and does not claim a refund", async () => {
    const { database, queries } = fixture();
    const sent: Array<{ message: TransactionalEmail; key: string }> = [];
    assert.equal(await notifyCancellation(database, scope, cancelled, async (message, key) => {
      sent.push({ message, key });
    }), cancelled);
    assert.deepEqual(queries[0].where, { id: scope.reservationId, hotelId: scope.hotelId, status: "CANCELLED" });
    assert.equal(queries[0].select?.cancellationReason, undefined);
    assert.equal(sent.length, 1);
    const [{ message, key }] = sent;
    assert.equal(key, "booking-cancelled/booking-test");
    assert.equal(message.to, "guest@example.com");
    assert.equal(message.subject, "Reservation cancelled: RSV-CANCEL");
    assert.match(message.text, /2026-12-01 to 2026-12-03/);
    assert.match(message.text, /did not issue a refund/);
    assert.doesNotMatch(message.text, /Private note/);
  });

  it("skips unsuccessful and unrelated updates and preserves cancellation when email fails", async () => {
    const { database, queries } = fixture();
    for (const result of [{ status: 409, body: {} }, { status: 200, body: {} }]) {
      assert.equal(await notifyCancellation(database, scope, result, async () => { assert.fail("Unexpected mail"); }), result);
    }
    assert.equal(queries.length, 0);
    assert.equal(await notifyCancellation(database, scope, cancelled, async () => {
      throw new Error("Provider unavailable");
    }), cancelled);
  });
});
