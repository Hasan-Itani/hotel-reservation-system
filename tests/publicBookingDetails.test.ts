import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { bookingDetailsRateLimit, readBookingDetails } from "../apps/api/src/public-bookings/booking-details";

const reservationNumber = "RSV-TEST-001";
const ownerId = "booking-owner";
const guestEmail = "guest@example.com";

describe("public booking details", () => {
  it("rejects missing or invalid credentials before querying the reservation", async () => {
    const database = {} as Pick<PrismaClient, "reservation">;
    assert.deepEqual(await readBookingDetails(database, reservationNumber, undefined, null), {
      status: 400, body: { error: "guestEmail is required unless you are signed in" },
    });
    assert.equal((await readBookingDetails(database, reservationNumber, undefined, "not-an-email")).status, 400);
  });

  it("returns the same private booking details for the owner or matching email", async () => {
    const scopes: Array<Prisma.ReservationWhereInput | undefined> = [];
    const database = {
      reservation: {
        findFirst: async ({ where }: Prisma.ReservationFindFirstArgs) => {
          scopes.push(where);
          const hasAccess = where?.OR?.some((filter) => filter.userId === ownerId || filter.guestEmail === guestEmail);
          return hasAccess
            ? {
                reservationNumber, guestEmail, status: "CONFIRMED", total: new Prisma.Decimal("125.5"),
                subtotal: new Prisma.Decimal("125.5"), taxes: 0, serviceFee: 0, discountAmount: 0,
                hotel: { name: "Fixture Hotel" }, reservationRooms: [],
                payments: [
                  { amount: new Prisma.Decimal("25.5"), status: "PAID", cardLast4: "4242" },
                  { amount: new Prisma.Decimal("50.00"), status: "REFUNDED" },
                ],
              }
            : null;
        },
      },
    } as unknown as Pick<PrismaClient, "reservation">;

    const ownerResult = await readBookingDetails(database, reservationNumber, ownerId, null);
    assert.equal(ownerResult.status, 200);
    assert.ok("booking" in ownerResult.body && ownerResult.body.booking);
    assert.deepEqual(ownerResult.body.booking.paymentSummary, { total: 125.5, paid: 25.5, remaining: 100 });
    assert.deepEqual(
      await readBookingDetails(database, reservationNumber, undefined, " Guest@Example.com "),
      ownerResult,
    );
    for (const result of [
      await readBookingDetails(database, reservationNumber, "another-account", null),
      await readBookingDetails(database, reservationNumber, undefined, "wrong@example.com"),
    ]) {
      assert.deepEqual(result, { status: 404, body: { error: "Booking not found" } });
    }
    assert.deepEqual(scopes, [
      [{ userId: ownerId }], [{ guestEmail }], [{ userId: "another-account" }], [{ guestEmail: "wrong@example.com" }],
    ].map((filters) => ({ reservationNumber, hotel: { deletedAt: null }, OR: filters })));
  });

  it("preserves the booking details rate-limit bucket", () => {
    assert.deepEqual(bookingDetailsRateLimit("127.0.0.1"), {
      key: "booking-details:127.0.0.1", windowMs: 600000, maxRequests: 10,
    });
  });
});
