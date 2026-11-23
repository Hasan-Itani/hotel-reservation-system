import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  listAdminReservations,
  listAdminReservationPayments,
  readAdminReservation,
  readAdminReservationPayment,
} from "../apps/api/src/admin-reservations/reservation-reads";

const hotelId = "test-hotel";
const reservationId = "test-reservation";
const paymentId = "test-payment";

describe("admin reservation and payment reads", () => {
  it("validates filter dates before accessing the database", async () => {
    const filters = new URLSearchParams({
      checkInFrom: "2027-01-05",
      checkInTo: "2027-01-01",
    });
    const result = await listAdminReservations({} as PrismaClient, hotelId, filters);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      error: "Validation failed",
      details: {
        formErrors: [],
        fieldErrors: { checkInTo: ["checkInTo must be on or after checkInFrom"] },
      },
    });
  });

  it("preserves hotel scoping, date boundaries, email normalization, and sort order", async () => {
    const reservation = {
      id: reservationId,
      total: new Prisma.Decimal("1250.50"),
    };
    const database = {
      hotel: {
        findFirst: async ({ where }: Prisma.HotelFindFirstArgs) => {
          assert.deepEqual(where, { id: hotelId, deletedAt: null });
          return { id: hotelId, name: "Test Hotel" };
        },
      },
      reservation: {
        findMany: async ({ where, orderBy }: Prisma.ReservationFindManyArgs) => {
          assert.deepEqual(where, {
            hotelId,
            status: "CONFIRMED",
            guestEmail: "guest@example.com",
            checkInDate: { gte: new Date("2027-01-01T00:00:00.000Z") },
            checkOutDate: { lte: new Date("2027-01-31T00:00:00.000Z") },
          });
          assert.deepEqual(orderBy, { createdAt: "desc" });
          return [reservation];
        },
      },
    } as unknown as PrismaClient;
    const filters = new URLSearchParams({
      status: "CONFIRMED",
      guestEmail: " Guest@Example.com ",
      checkInFrom: "2027-01-01",
      checkOutTo: "2027-01-31",
    });
    const result = await listAdminReservations(database, hotelId, filters);
    assert.equal(result.status, 200);
    assert.equal(
      JSON.stringify(result.body),
      JSON.stringify({ hotelId, hotelName: "Test Hotel", reservations: [{ ...reservation, total: "1250.5" }] }),
    );
  });

  it("scopes detail and payment lookups to their hotel and reservation", async () => {
    const database = {
      reservation: {
        findFirst: async ({ where }: Prisma.ReservationFindFirstArgs) => {
          assert.deepEqual(where, { id: reservationId, hotelId });
          return null;
        },
      },
      payment: {
        findFirst: async ({ where }: Prisma.PaymentFindFirstArgs) => {
          assert.deepEqual(where, { id: paymentId, reservationId, reservation: { hotelId } });
          return null;
        },
      },
    } as unknown as PrismaClient;

    assert.deepEqual(await readAdminReservation(database, hotelId, reservationId), {
      status: 404, body: { error: "Reservation not found" },
    });
    assert.deepEqual(await listAdminReservationPayments(database, hotelId, reservationId), {
      status: 404, body: { error: "Reservation not found" },
    });
    assert.deepEqual(await readAdminReservationPayment(database, hotelId, reservationId, paymentId), {
      status: 404, body: { error: "Payment not found" },
    });
  });
});
