import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "../lib/permissions";
import { createRoom, deleteRoom, updateRoom } from "../apps/api/src/admin-rooms/room-writes";
import { createRoomType, deleteRoomType, updateRoomType } from "../apps/api/src/admin-rooms/room-type-writes";

const hotelId = "assigned-hotel";
const roomTypeId = "256f8162-f708-4ae7-8013-96222f0ec595";
const roomId = "test-room";
const manager: AuthUser = {
  id: "test-manager",
  firstName: "Test",
  lastName: "Manager",
  email: "manager@example.com",
  status: "ACTIVE",
  globalRoles: [],
  hotelRoles: [{ hotelId, hotelName: "Test Hotel", role: "MANAGER" }],
};

describe("admin inventory writes", () => {
  it("denies all six writes before reading a body or inventory without the required role", async () => {
    const database = {} as PrismaClient;
    const unread = async () => { assert.fail("Unauthorized request body was read"); };
    const receptionist = { ...manager, hotelRoles: [{ ...manager.hotelRoles[0], role: "RECEPTIONIST" }] };
    const guest = { ...manager, hotelRoles: [] };
    const write = (user: AuthUser | null, targetHotelId: string) => Promise.all([
      createRoom(database, user, targetHotelId, unread),
      updateRoom(database, user, targetHotelId, roomId, unread),
      deleteRoom(database, user, targetHotelId, roomId),
      createRoomType(database, user, targetHotelId, unread),
      updateRoomType(database, user, targetHotelId, roomTypeId, unread),
      deleteRoomType(database, user, targetHotelId, roomTypeId),
    ]);

    for (const result of await write(null, hotelId)) assert.equal(result.status, 401);
    for (const result of await write(guest, hotelId)) assert.equal(result.status, 403);
    for (const result of await write(manager, "other-hotel")) assert.equal(result.status, 403);
    for (const result of await write(receptionist, hotelId)) {
      assert.deepEqual(result, {
        status: 403,
        body: { error: "Requires HOTEL_ADMIN or MANAGER role for this hotel" },
      });
    }
  });

  it("creates a scoped room and writes its audit event with the authorized actor", async () => {
    const audit: Prisma.AuditLogUncheckedCreateInput[] = [];
    const database = {
      hotel: { findFirst: async () => ({ id: hotelId }) },
      roomType: {
        findFirst: async ({ where }: Prisma.RoomTypeFindFirstArgs) => {
          assert.deepEqual(where, { id: roomTypeId, hotelId, deletedAt: null });
          return { id: roomTypeId, name: "Test Suite" };
        },
      },
      room: {
        findFirst: async () => null,
        create: async ({ data }: { data: Prisma.RoomUncheckedCreateInput }) => {
          assert.equal(data.hotelId, hotelId);
          assert.equal(data.roomTypeId, roomTypeId);
          assert.equal(data.status, "AVAILABLE");
          return { ...data, id: roomId, roomType: { name: "Test Suite" } };
        },
      },
      auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => audit.push(data) },
    } as unknown as PrismaClient;

    const room = await createRoom(database, manager, hotelId, async () => ({ roomNumber: "T-01", roomTypeId }));
    assert.equal(room.status, 201);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].hotelId, hotelId);
    assert.equal(audit[0].actorUserId, manager.id);
    assert.equal(audit[0].action, "ROOM_CREATED");
    assert.equal(audit[0].entityId, roomId);
  });

  it("blocks status changes and deletion for rooms assigned to an active reservation", async () => {
    const database = {
      room: {
        findFirst: async ({ where }: Prisma.RoomFindFirstArgs) => {
          assert.deepEqual(where, { id: roomId, hotelId, deletedAt: null });
          return { id: roomId, roomNumber: "T-01", roomTypeId, status: "AVAILABLE" };
        },
      },
      reservationRoom: {
        findFirst: async () => ({ reservation: { id: "test-reservation", reservationNumber: "RSV-TEST", status: "CONFIRMED" } }),
      },
    } as unknown as PrismaClient;
    const edit = await updateRoom(database, manager, hotelId, roomId, async () => ({ status: "MAINTENANCE" }));
    assert.equal(edit.status, 409);
    assert.equal(Reflect.get(edit.body, "reservationNumber"), "RSV-TEST");
    const removal = await deleteRoom(database, manager, hotelId, roomId);
    assert.equal(removal.status, 409);
    assert.equal(Reflect.get(removal.body, "reservationNumber"), "RSV-TEST");
  });

  it("blocks deletion of a room type while a room still uses it", async () => {
    const database = {
      roomType: { findFirst: async () => ({ id: roomTypeId, name: "Test Suite" }) },
      room: { count: async () => 1 },
    } as unknown as PrismaClient;
    const result = await deleteRoomType(database, manager, hotelId, roomTypeId);
    assert.equal(result.status, 409);
    assert.equal(Reflect.get(result.body, "roomCount"), 1);
  });
});
