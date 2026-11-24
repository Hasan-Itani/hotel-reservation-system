import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient, type ReservationStatus } from "@prisma/client";
import {
  createAdminReservation,
  updateAdminReservation,
} from "../apps/api/src/admin-reservations/reservation-writes";
import type { AuthUser } from "../lib/permissions";

const hotelId = "fixture-hotel";
const reservationId = "fixture-reservation";
const roomTypeId = "256f8162-f708-4ae7-8013-96222f0ec595";
const reservationRoomId = "31041d26-e178-4214-90f6-d195ca11f225";
const roomId = "bb442f89-a882-458b-b2e0-bf17744b7560";
const staff: AuthUser = {
  id: "fixture-staff",
  firstName: "Demo",
  lastName: "Staff",
  email: "staff@example.com",
  status: "ACTIVE",
  globalRoles: [],
  hotelRoles: [{ hotelId, hotelName: "Fixture Hotel", role: "RECEPTIONIST" }],
};
const booking = {
  guestFirstName: "Test",
  guestLastName: "Guest",
  guestEmail: "guest@example.com",
  checkInDate: "2030-11-25",
  checkOutDate: "2030-11-27",
  adults: 2,
  taxes: 10,
  rooms: [{ roomTypeId, guests: 2 }],
};

describe("admin reservation writes", () => {
  it("enforces both hotel scope and the write role before parsing or querying", async () => {
    const database = {} as PrismaClient;
    const unread = async () => assert.fail("An unauthorized request tried to read the body");
    const otherRole = { ...staff, hotelRoles: [{ ...staff.hotelRoles[0], role: "HOUSEKEEPING" }] };
    assert.equal((await createAdminReservation(database, null, hotelId, unread)).status, 401);
    assert.equal((await createAdminReservation(database, staff, "other-hotel", unread)).status, 403);
    assert.equal((await updateAdminReservation(database, otherRole, hotelId, reservationId, unread)).status, 403);
    assert.equal((await updateAdminReservation(database, staff, hotelId, reservationId, async () => ({ action: "CHECK_IN" }))).status, 400);
  });

  it("locks inventory before creating a priced reservation and writes the audit event inside the transaction", async () => {
    const operations: string[] = [];
    const transaction = {
      $executeRaw: async (query: TemplateStringsArray) => {
        assert.match(query.join("?"), /pg_advisory_xact_lock/);
        operations.push("lock");
      },
      roomType: {
        findMany: async () => {
          operations.push("availability");
          return [{ id: roomTypeId, basePrice: new Prisma.Decimal("120.25"), capacityAdults: 2, capacityChildren: 0, _count: { rooms: 1 } }];
        },
      },
      reservationRoom: { groupBy: async () => [] },
      reservation: {
        create: async ({ data }: { data: Prisma.ReservationUncheckedCreateInput }) => {
          assert.equal(data.hotelId, hotelId);
          assert.equal(data.total, 250.5);
          operations.push("write");
          return { ...data, id: reservationId, status: "PENDING" };
        },
      },
      auditLog: {
        create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          assert.equal(data.actorUserId, staff.id);
          assert.equal(data.action, "RESERVATION_CREATED");
          operations.push("audit");
        },
      },
    };
    const database = {
      hotel: { findFirst: async () => ({ id: hotelId, currency: "USD" }) },
      $transaction: async (
        call: (client: typeof transaction) => Promise<unknown>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) => {
        assert.equal(options.isolationLevel, "Serializable");
        return call(transaction);
      },
    } as unknown as PrismaClient;
    const result = await createAdminReservation(database, staff, hotelId, async () => booking);
    assert.equal(result.status, 201);
    assert.deepEqual(operations, ["lock", "availability", "write", "audit"]);
  });

  it("checks in and out, updating the assigned room and recording both audit events", async () => {
    let status: ReservationStatus = "CONFIRMED";
    let assignedRoom: string | null = null;
    const roomStatuses: string[] = [];
    const auditActions: string[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const checkInDate = new Date(today);
    checkInDate.setUTCDate(today.getUTCDate() - 2);
    const checkOutDate = new Date(today);
    checkOutDate.setUTCDate(today.getUTCDate() + 2);
    const reservation = {
      findFirst: async ({ where }: Prisma.ReservationFindFirstArgs) => {
        assert.deepEqual(where, { id: reservationId, hotelId });
        return {
          id: reservationId, reservationNumber: "RSV-FIXTURE", status,
          checkInDate, checkOutDate, hotel: { timezone: "Asia/Beirut" },
          reservationRooms: [{ id: reservationRoomId, roomId: assignedRoom, roomTypeId }],
        };
      },
      updateMany: async ({ where, data }: Prisma.ReservationUpdateManyArgs) => {
        assert.deepEqual(where, { id: reservationId, hotelId, status });
        status = data.status as ReservationStatus;
        return { count: 1 };
      },
    };
    const room = {
      findMany: async () => [{ id: roomId, roomTypeId, status: "AVAILABLE" }],
      updateMany: async ({ where, data }: Prisma.RoomUpdateManyArgs) => {
        assert.equal(where?.hotelId, hotelId);
        assert.deepEqual(where?.id, { in: [roomId] });
        roomStatuses.push(String(data.status));
        return { count: 1 };
      },
    };
    const reservationRoom = {
      findMany: async () => [],
      update: async ({ data }: { data: Prisma.ReservationRoomUncheckedUpdateInput }) => {
        assignedRoom = String(data.roomId);
      },
    };
    const transaction = {
      room, reservation, reservationRoom,
      auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => auditActions.push(data.action) },
    };
    const database = {
      room, reservation, reservationRoom,
      $transaction: async (call: (client: typeof transaction) => Promise<unknown>) => call(transaction),
    } as unknown as PrismaClient;
    const update = (body: unknown) => updateAdminReservation(database, staff, hotelId, reservationId, async () => body);

    assert.equal((await update({ action: "CHECK_OUT" })).status, 409);
    assert.equal((await update({ action: "CHECK_IN", roomAssignments: [{ reservationRoomId, roomId }] })).status, 200);
    assert.equal(status, "CHECKED_IN");
    assert.equal(assignedRoom, roomId);
    const checkout = await update({ action: "CHECK_OUT" });
    assert.equal(checkout.status, 200);
    assert.equal(checkout.checkoutCompleted, true);
    assert.equal(status, "CHECKED_OUT");
    const repeat = await update({ action: "CHECK_OUT" });
    assert.equal(repeat.status, 409);
    assert.equal(repeat.checkoutCompleted, undefined);
    assert.deepEqual(roomStatuses, ["OCCUPIED", "AVAILABLE"]);
    assert.deepEqual(auditActions, ["RESERVATION_CHECKED_IN", "RESERVATION_CHECKED_OUT"]);
  });

  it("rejects check-in before arrival without starting an inventory transaction", async () => {
    const database = {
      reservation: { findFirst: async () => ({
        id: reservationId, status: "CONFIRMED", checkInDate: new Date("2099-11-25"), hotel: { timezone: "Asia/Beirut" },
      }) },
      $transaction: async () => assert.fail("Early check-in should not write inventory"),
    } as unknown as PrismaClient;
    const response = await updateAdminReservation(database, staff, hotelId, reservationId, async () => ({
      action: "CHECK_IN",
      roomAssignments: [{ reservationRoomId, roomId }],
    }));
    assert.deepEqual(response, { status: 409, body: { error: "Check-in is not available before the scheduled arrival date" } });
  });
});
