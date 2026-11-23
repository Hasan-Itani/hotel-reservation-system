import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { unlockAdminGuest } from "../apps/api/src/admin-people/guest-unlock";
import { createAdminStaff, removeAdminStaff, updateAdminStaff } from "../apps/api/src/admin-people/staff-writes";
import type { AuthUser } from "../lib/permissions";

const hotelId = "fixture-hotel";
const targetId = "fixture-target";
const hotel = { id: hotelId, name: "Fixture Hotel" };
const admin: AuthUser = {
  id: "fixture-admin",
  firstName: "Test",
  lastName: "Admin",
  email: "admin@example.com",
  status: "ACTIVE",
  globalRoles: [],
  hotelRoles: [{ hotelId, hotelName: hotel.name, role: "HOTEL_ADMIN" }],
};

describe("admin guest and staff writes", () => {
  it("enforces hotel-admin access on all writes and blocks self-service changes", async () => {
    const database = {} as PrismaClient;
    const manager = { ...admin, hotelRoles: [{ ...admin.hotelRoles[0], role: "MANAGER" }] };
    const unread = async () => assert.fail("An unauthorized request tried to read the body");
    assert.equal((await unlockAdminGuest(database, null, hotelId, targetId)).status, 401);
    assert.equal((await unlockAdminGuest(database, admin, "other-hotel", targetId)).status, 403);
    assert.equal((await createAdminStaff(database, manager, hotelId, unread)).status, 403);
    assert.equal((await updateAdminStaff(database, manager, hotelId, targetId, unread)).status, 403);
    assert.equal((await removeAdminStaff(database, manager, hotelId, targetId)).status, 403);
    assert.equal((await unlockAdminGuest(database, admin, hotelId, admin.id)).status, 409);
    assert.equal((await updateAdminStaff(database, admin, hotelId, admin.id, unread)).status, 409);
    assert.equal((await removeAdminStaff(database, admin, hotelId, admin.id)).status, 409);
  });

  it("unlocks only linked guests, invalidates their sessions, and records the audit event", async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    let staff = true;
    const audits: Prisma.AuditLogUncheckedCreateInput[] = [];
    let updates = 0;
    const database = {
      hotel: { findFirst: async () => hotel },
      user: {
        findFirst: async ({ where }: Prisma.UserFindFirstArgs) => {
          assert.deepEqual(where, { id: targetId, deletedAt: null, reservations: { some: { hotelId } } });
          return {
            id: targetId, firstName: "Test", lastName: "Guest", email: "guest@example.com",
            status: "ACTIVE", failedLoginAttempts: 5, lockedUntil,
            userRoles: [], UserHotelRole: staff ? [{ id: "assignment" }] : [],
          };
        },
        update: async ({ where, data }: Prisma.UserUpdateArgs) => {
          assert.deepEqual(where, { id: targetId });
          assert.deepEqual(data, { failedLoginAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } });
          updates += 1;
          return { id: targetId, failedLoginAttempts: 0, lockedUntil: null };
        },
      },
      auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => audits.push(data) },
    } as unknown as PrismaClient;

    assert.equal((await unlockAdminGuest(database, admin, hotelId, targetId)).status, 409);
    assert.equal(updates, 0);
    staff = false;
    assert.equal((await unlockAdminGuest(database, admin, hotelId, targetId)).status, 200);
    assert.equal(updates, 1);
    assert.equal(audits[0].action, "ACCOUNT_UNLOCKED");
    assert.equal(audits[0].actorUserId, admin.id);
    assert.equal(audits[0].entityId, targetId);
  });

  it("blocks demotion and removal of the last hotel admin", async () => {
    const currentRole = { id: "hotel-admin-role", name: "HOTEL_ADMIN" };
    const database = {
      hotel: { findFirst: async () => hotel },
      userHotelRole: {
        findMany: async () => [{ roleId: currentRole.id, Role: currentRole, User: { id: targetId, status: "ACTIVE" } }],
        count: async ({ where }: Prisma.UserHotelRoleCountArgs) => {
          assert.deepEqual(where, {
            hotelId, roleId: currentRole.id, userId: { not: targetId }, User: { deletedAt: null, status: "ACTIVE" },
          });
          return 0;
        },
      },
      role: {
        findUnique: async () => currentRole,
        findMany: async () => [{ id: "reception-role", name: "RECEPTIONIST" }],
      },
    } as unknown as PrismaClient;
    const superAdmin = { ...admin, globalRoles: ["SUPER_ADMIN"], hotelRoles: [] };

    const demotion = await updateAdminStaff(database, superAdmin, hotelId, targetId, async () => ({ roleNames: ["RECEPTIONIST"] }));
    const removal = await removeAdminStaff(database, superAdmin, hotelId, targetId);
    assert.equal(demotion.status, 409);
    assert.equal(removal.status, 409);
    assert.match(String(Reflect.get(demotion.body, "error")), /last HOTEL_ADMIN/);
    assert.match(String(Reflect.get(removal.body, "error")), /last HOTEL_ADMIN/);
  });
});
