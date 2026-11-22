import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createPublicReservation } from "../apps/api/src/booking-domain/create-public-reservation";
import { publicReservationCreateSchema } from "../lib/validators";

const roomTypeId = "256f8162-f708-4ae7-8013-96222f0ec595";
const guest = { id: "guest-id", sessionVersion: 3 };
const request = {
  guestFirstName: "Test",
  guestLastName: "Guest",
  guestEmail: "form@example.com",
  checkInDate: "2030-09-10",
  checkOutDate: "2030-09-12",
  adults: 2,
  rooms: [{ roomTypeId, guests: 2 }],
};

function bookingFixture(reservedRooms: number) {
  const operations: string[] = [];
  const roomType = {
    id: roomTypeId,
    name: "Test Suite",
    basePrice: new Prisma.Decimal("120.25"),
    capacityAdults: 2,
    capacityChildren: 0,
    _count: { rooms: 1 },
  };
  const transaction = {
    $executeRaw: async (query: TemplateStringsArray) => {
      assert.match(query.join("?"), /pg_advisory_xact_lock/);
      operations.push("lock");
    },
    user: {
      findUnique: async ({ where }: { where: Prisma.UserWhereUniqueInput }) => {
        assert.deepEqual(where, { ...guest, status: "ACTIVE", deletedAt: null });
        return { email: "account@example.com" };
      },
    },
    roomType: {
      findMany: async () => {
        operations.push("inventory");
        return [roomType];
      },
    },
    reservationRoom: {
      groupBy: async () => [{ roomTypeId, _count: { _all: reservedRooms } }],
    },
    reservation: {
      create: async ({ data }: { data: Prisma.ReservationUncheckedCreateInput }) => {
        operations.push("create");
        assert.equal(data.userId, guest.id);
        assert.equal(data.guestEmail, "account@example.com");
        assert.equal(data.guestPhone, null);
        assert.equal(data.specialRequests, null);
        assert.equal(data.total, 240.5);
        assert.deepEqual(data.reservationRooms?.create, [{ roomTypeId, nightlyPrice: 120.25, guests: 2 }]);
        return {
          ...data,
          status: "PENDING",
          total: new Prisma.Decimal(String(data.total)),
          reservationRooms: [{ roomType, nightlyPrice: roomType.basePrice, guests: 2 }],
        };
      },
    },
  };
  const database = {
    hotel: { findFirst: async () => ({ id: "hotel-id", currency: "USD" }) },
    $transaction: async (
      operation: (client: typeof transaction) => Promise<unknown>,
      options: { isolationLevel: Prisma.TransactionIsolationLevel },
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      return operation(transaction);
    },
  } as unknown as PrismaClient;
  return { database, operations };
}

describe("public reservation creation", () => {
  it("normalizes omitted, blank, and null optional text", () => {
    for (const value of [undefined, "  ", null]) {
      const parsed = publicReservationCreateSchema.parse({ ...request, guestPhone: value, specialRequests: value });
      assert.equal(parsed.guestPhone, null);
      assert.equal(parsed.specialRequests, null);
    }
  });

  it("locks inventory before creating a pending booking priced by the server", async () => {
    const { database, operations } = bookingFixture(0);
    const result = await createPublicReservation(database, "test-hotel", guest, publicReservationCreateSchema.parse(request));
    assert.deepEqual(operations, ["lock", "inventory", "create"]);
    assert.equal(result.status, 201);
    const reservation = result.body.reservation;
    assert.ok(reservation);
    assert.equal(reservation.status, "PENDING");
    assert.equal(JSON.stringify(reservation.total), '"240.5"');
  });

  it("returns a conflict without creating a booking when every room is reserved", async () => {
    const { database, operations } = bookingFixture(1);
    const result = await createPublicReservation(database, "test-hotel", guest, publicReservationCreateSchema.parse(request));
    assert.deepEqual(operations, ["lock", "inventory"]);
    assert.equal(result.status, 409);
    assert.equal(Reflect.get(result.body, "availableRooms"), 0);
  });
});
