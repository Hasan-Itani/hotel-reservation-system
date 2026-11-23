import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { listAdminGuests, listAdminStaff, readAdminStaff } from "../apps/api/src/admin-people/people-reads";
import type { AuthUser } from "../lib/permissions";

const hotelId = "fixture-hotel";
const hotel = { id: hotelId, name: "Fixture Hotel" };
const guest: AuthUser = {
  id: "fixture-user",
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  status: "ACTIVE",
  globalRoles: [],
  hotelRoles: [],
};
const withRole = (role: string) => ({
  ...guest,
  hotelRoles: [{ hotelId, hotelName: hotel.name, role }],
});

describe("admin guest and staff reads", () => {
  it("blocks guest access and enforces distinct hotel-specific roles", async () => {
    const database = {} as PrismaClient;
    assert.equal((await listAdminGuests(database, null, hotelId)).status, 401);
    assert.equal((await listAdminGuests(database, guest, hotelId)).status, 403);
    assert.equal((await listAdminGuests(database, withRole("HOUSEKEEPING"), hotelId)).status, 403);
    assert.equal((await listAdminGuests(database, withRole("RECEPTIONIST"), "other-hotel")).status, 403);
    assert.equal((await listAdminStaff(database, withRole("MANAGER"), hotelId)).status, 403);
    assert.equal((await readAdminStaff(database, withRole("HOTEL_ADMIN"), "other-hotel", "staff")).status, 403);
  });

  it("aggregates hotel-scoped guest bookings and excludes failed payments", async () => {
    const reservation = {
      userId: null,
      user: null,
      guestFirstName: "First",
      guestLastName: "Guest",
      guestPhone: null,
      guestEmail: "Guest@Example.com",
      status: "CONFIRMED",
      total: 120.51,
      currency: "USD",
      reservationNumber: "RSV-LATEST",
      createdAt: new Date("2026-11-01"),
    };
    const database = {
      hotel: { findFirst: async () => hotel },
      reservation: {
        findMany: async ({ where }: Prisma.ReservationFindManyArgs) => {
          assert.deepEqual(where, { hotelId, hotel: { deletedAt: null } });
          return [
            { ...reservation, payments: [{ status: "PAID", amount: 120.51 }] },
            { ...reservation, guestEmail: "guest@example.com", reservationNumber: "RSV-OLDER",
              createdAt: new Date("2026-10-01"), payments: [{ status: "FAILED", amount: 120.51 }] },
          ];
        },
      },
    } as unknown as PrismaClient;
    const result = await listAdminGuests(database, withRole("RECEPTIONIST"), hotelId);
    assert.equal(result.status, 200);
    const guests = Reflect.get(result.body, "guests");
    assert.equal(guests.length, 1);
    assert.equal(guests[0].totalReservations, 2);
    assert.equal(guests[0].totalBooked, 241.02);
    assert.equal(guests[0].totalPaid, 120.51);
    assert.equal(guests[0].latestReservation.reservationNumber, "RSV-LATEST");
  });

  it("lists and reads staff by hotel, with role details and no internal assignment fields", async () => {
    const user = { id: "staff", firstName: "Test", lastName: "Staff", email: "staff@example.com" };
    const role = { id: "receptionist", name: "RECEPTIONIST", description: null };
    const whereClauses: Array<Prisma.UserHotelRoleWhereInput | undefined> = [];
    const database = {
      hotel: { findFirst: async () => hotel },
      userHotelRole: {
        findMany: async ({ where }: Prisma.UserHotelRoleFindManyArgs) => {
          whereClauses.push(where);
          return where?.userId === "missing" ? [] : [{ User: user, Role: role, roleId: role.id }];
        },
      },
    } as unknown as PrismaClient;
    const list = await listAdminStaff(database, withRole("HOTEL_ADMIN"), hotelId);
    const detail = await readAdminStaff(database, { ...guest, globalRoles: ["SUPER_ADMIN"] }, hotelId, user.id);
    const missing = await readAdminStaff(database, withRole("HOTEL_ADMIN"), hotelId, "missing");
    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assert.equal(missing.status, 404);
    const staff = Reflect.get(detail.body, "staff");
    assert.deepEqual(Reflect.get(list.body, "staff"), [staff]);
    assert.deepEqual(staff.roles, [role]);
    assert.equal("roleId" in staff, false);
    assert.deepEqual(whereClauses, [
      { hotelId, User: { deletedAt: null } },
      { hotelId, userId: user.id, User: { deletedAt: null } },
      { hotelId, userId: "missing", User: { deletedAt: null } },
    ]);
  });
});
