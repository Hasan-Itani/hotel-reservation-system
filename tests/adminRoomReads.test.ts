import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getAdminAvailability } from "../apps/api/src/admin-rooms/room-availability";
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
  it("checks admin availability access and dates before looking up inventory", async () => {
    const staff: AuthUser = {
      id: "staff-fixture",
      firstName: "Test",
      lastName: "Staff",
      email: "staff@example.com",
      status: "ACTIVE",
      globalRoles: [],
      hotelRoles: [{ hotelId, hotelName: "Fixture Hotel", role: "RECEPTIONIST" }],
    };
    const noDatabase = {} as PrismaClient;
    const reversed = new URLSearchParams({ checkInDate: "2026-12-12", checkOutDate: "2026-12-10" });
    assert.equal((await getAdminAvailability(noDatabase, null, hotelId, reversed)).status, 401);
    assert.equal((await getAdminAvailability(noDatabase, staff, "other-hotel", reversed)).status, 403);
    assert.deepEqual(await getAdminAvailability(noDatabase, staff, hotelId, reversed), {
      status: 400,
      body: {
        error: "Validation failed",
        details: { formErrors: [], fieldErrors: { checkOutDate: ["checkOutDate must be after checkInDate"] } },
      },
    });

    const dates = new URLSearchParams({
      checkInDate: "2026-12-10", checkOutDate: "2026-12-12", adults: "2", children: "1",
    });
    const missingHotel = {
      hotel: { findFirst: async () => null },
    } as unknown as PrismaClient;
    assert.equal((await getAdminAvailability(missingHotel, staff, hotelId, dates)).status, 404);

    const database = {
      hotel: {
        findFirst: async ({ where }: Prisma.HotelFindFirstArgs) => {
          assert.deepEqual(where, { id: hotelId, deletedAt: null });
          return { id: hotelId, name: "Fixture Hotel", currency: "USD" };
        },
      },
      roomType: {
        findMany: async ({ where }: Prisma.RoomTypeFindManyArgs) => {
          assert.deepEqual(where, {
            hotelId, deletedAt: null, capacityAdults: { gte: 2 }, capacityChildren: { gte: 1 },
          });
          return [{ ...roomType, _count: { rooms: 3 } }];
        },
      },
      reservationRoom: {
        groupBy: async ({ where }: Prisma.ReservationRoomGroupByArgs) => {
          assert.ok(where?.reservation);
          assert.equal(where.reservation.hotelId, hotelId);
          assert.deepEqual(where.reservation.checkInDate, { lt: new Date("2026-12-12") });
          assert.deepEqual(where.reservation.checkOutDate, { gt: new Date("2026-12-10") });
          return [{ roomTypeId: roomType.id, _count: { _all: 1 } }];
        },
      },
    } as unknown as PrismaClient;

    const result = await getAdminAvailability(database, staff, hotelId, dates);
    assert.equal(result.status, 200);
    assert.ok("roomTypes" in result.body && result.body.roomTypes);
    assert.equal(result.body.hotelId, hotelId);
    assert.equal(result.body.roomTypes[0].availableRooms, 2);
  });

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
