import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { formatRoomTypeResponse, getRoomById, getRoomTypeById, listRooms, listRoomTypes } from "../apps/api/src/admin-rooms/room-reads";
import { canAccessHotel, type AuthUser } from "../lib/permissions";

const hotelId = "hotel-fixture";
const amenity = { id: "wifi", name: "Wi-Fi", icon: null };
const roomType = {
  id: "room-type-fixture",
  basePrice: new Prisma.Decimal("125.50"),
  amenities: [{ amenity }],
};
const room = { id: "room-fixture", roomType };

describe("admin inventory reads", () => {
  it("keeps the existing hotel scope for guests, assigned staff, and super admins", () => {
    const guest: AuthUser = {
      id: "guest-fixture",
      firstName: "Test",
      lastName: "Guest",
      email: "guest@example.com",
      status: "ACTIVE",
      globalRoles: [],
      hotelRoles: [],
    };
    const staff = { ...guest, hotelRoles: [{ hotelId, hotelName: "Fixture Hotel", role: "RECEPTIONIST" }] };
    assert.equal(canAccessHotel(guest, hotelId), false);
    assert.equal(canAccessHotel(staff, hotelId), true);
    assert.equal(canAccessHotel(staff, "other-hotel"), false);
    assert.equal(canAccessHotel({ ...guest, globalRoles: ["SUPER_ADMIN"] }, "other-hotel"), true);
  });

  it("filters all room and room-type queries by hotel and soft-deletion status", async () => {
    const database = {
      room: {
        findMany: async ({ where }: Prisma.RoomFindManyArgs) => {
          assert.deepEqual(where, { hotelId, deletedAt: null });
          return [room];
        },
        findFirst: async ({ where }: Prisma.RoomFindFirstArgs) => {
          assert.deepEqual(where, { id: room.id, hotelId, deletedAt: null });
          return room;
        },
      },
      roomType: {
        findMany: async ({ where }: Prisma.RoomTypeFindManyArgs) => {
          assert.deepEqual(where, { hotelId, deletedAt: null });
          return [roomType];
        },
        findFirst: async ({ where }: Prisma.RoomTypeFindFirstArgs) => {
          assert.deepEqual(where, { id: roomType.id, hotelId, deletedAt: null });
          return roomType;
        },
      },
    } as unknown as PrismaClient;

    assert.deepEqual(await listRooms(database, hotelId), { hotelId, rooms: [room] });
    assert.equal((await getRoomById(database, hotelId, room.id))?.id, room.id);

    const expectedType = { ...roomType, amenities: [amenity] };
    assert.deepEqual(await listRoomTypes(database, hotelId), { hotelId, roomTypes: [expectedType] });
    const detail = await getRoomTypeById(database, hotelId, roomType.id);
    assert.ok(detail);
    assert.deepEqual(formatRoomTypeResponse(detail), expectedType);
    assert.equal(JSON.stringify(detail.basePrice), '"125.5"');
  });
});
