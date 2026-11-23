import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { listHotelAudit } from "../apps/api/src/inquiries/audit-reads";
import { createPublicHotelInquiry, listAdminInquiries, updateAdminInquiry } from "../apps/api/src/inquiries/inquiry-actions";
import { buildHotelAuditVisibilityWhere } from "../lib/auditEvents";
import type { AuthUser } from "../lib/permissions";

const hotelId = "fixture-hotel";
const inquiryId = "fixture-inquiry";
const hotel = { id: hotelId, name: "Fixture Hotel" };
const staff: AuthUser = {
  id: "fixture-staff",
  firstName: "Test",
  lastName: "Staff",
  email: "staff@example.com",
  status: "ACTIVE",
  globalRoles: [],
  hotelRoles: [{ hotelId, hotelName: hotel.name, role: "RECEPTIONIST" }],
};

describe("hotel inquiries and audit activity", () => {
  it("keeps inquiry access hotel-scoped and reserves audit for managers and admins", async () => {
    const database = {} as PrismaClient;
    const unread = async () => assert.fail("An unauthorized request tried to read the body");
    assert.equal((await listAdminInquiries(database, null, hotelId)).status, 401);
    assert.equal((await listAdminInquiries(database, staff, "other-hotel")).status, 403);
    assert.equal((await updateAdminInquiry(database, staff, "other-hotel", inquiryId, unread)).status, 403);
    assert.equal((await listHotelAudit(database, staff, hotelId, new URLSearchParams())).status, 403);
  });

  it("stores a normalized public inquiry without exposing admin notes", async () => {
    const database = {
      hotel: { findFirst: async ({ where }: Prisma.HotelFindFirstArgs) => {
        assert.deepEqual(where, { slug: "fixture", deletedAt: null });
        return hotel;
      } },
      hotelInquiry: { create: async ({ data, select }: Prisma.HotelInquiryCreateArgs) => {
        assert.equal(select?.adminNote, undefined);
        assert.equal(Reflect.get(data, "hotelId"), hotelId);
        assert.equal(data.guestEmail, "guest@example.com");
        assert.equal(data.guestPhone, null);
        return { id: inquiryId, ...data, status: "NEW" };
      } },
    } as unknown as PrismaClient;
    const saved = await createPublicHotelInquiry(database, "fixture", async () => ({
      guestName: "Test Guest",
      guestEmail: " Guest@Example.com ",
      subject: "Test inquiry",
      message: "Please ignore this test inquiry.",
    }));
    assert.equal(saved.status, 201);
    assert.equal(Reflect.get(saved.body, "inquiry").status, "NEW");
  });

  it("updates an inquiry and its audit record in the same transaction", async () => {
    const operations: string[] = [];
    const scope = { id: inquiryId, hotelId };
    const tx = {
      hotelInquiry: {
        findFirst: async ({ where }: Prisma.HotelInquiryFindFirstArgs) => {
          assert.deepEqual(where, scope);
          return { id: inquiryId, status: "NEW", adminNote: null, subject: "Fixture" };
        },
        update: async ({ where, data }: Prisma.HotelInquiryUpdateArgs) => {
          assert.deepEqual(where, scope);
          assert.equal(data.status, "REPLIED");
          assert.equal(data.adminNote, "Staff follow-up");
          assert.ok(data.readAt instanceof Date);
          assert.ok(data.repliedAt instanceof Date);
          operations.push("update");
          return { id: inquiryId, subject: "Fixture", ...data };
        },
      },
      auditLog: {
        create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          assert.equal(data.actorUserId, staff.id);
          assert.equal(data.action, "INQUIRY_UPDATED");
          assert.deepEqual(data.metadata, { previousStatus: "NEW", nextStatus: "REPLIED", adminNoteChanged: true });
          operations.push("audit");
        },
      },
    };
    const database = { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
    const result = await updateAdminInquiry(database, staff, hotelId, inquiryId, async () => ({ status: "REPLIED", adminNote: " Staff follow-up " }));
    assert.equal(result.status, 200);
    assert.deepEqual(operations, ["update", "audit"]);
  });

  it("applies hotel visibility to audit entries and filter options", async () => {
    const calls: Prisma.AuditLogFindManyArgs[] = [];
    const database = {
      hotel: { findFirst: async () => hotel },
      auditLog: { findMany: async (args: Prisma.AuditLogFindManyArgs) => { calls.push(args); return []; } },
    } as unknown as PrismaClient;
    const manager = { ...staff, hotelRoles: [{ ...staff.hotelRoles[0], role: "MANAGER" }] };
    const filters = new URLSearchParams({ eventCategory: "GUEST_INQUIRIES", limit: "999", actorUserId: staff.id });
    const result = await listHotelAudit(database, manager, hotelId, filters);
    const visibility = buildHotelAuditVisibilityWhere(hotelId);
    assert.equal(result.status, 200);
    assert.deepEqual(calls[0].where, { AND: [visibility, { action: { in: ["INQUIRY_UPDATED"] } }, { actorUserId: staff.id }] });
    assert.equal(calls[0].take, 200);
    assert.ok(calls.slice(1).every((call) => call.where && JSON.stringify(call.where) === JSON.stringify(visibility)));
  });

  for (const status of ["NEW", "READ", "REPLIED", "ARCHIVED"] as const) {
    it(`does not write or audit a repeated ${status} action`, async () => {
      const timestamp = new Date("2026-11-23T14:00:00Z");
      const inquiry = {
        id: inquiryId, status, adminNote: "Follow-up",
        readAt: status === "NEW" ? null : timestamp,
        repliedAt: status === "REPLIED" ? timestamp : null,
        archivedAt: status === "ARCHIVED" ? timestamp : null,
        updatedAt: timestamp,
      };
      const tx = {
        hotelInquiry: {
          findFirst: async () => inquiry,
          update: async () => assert.fail("An unchanged inquiry must not be written"),
        },
        auditLog: { create: async () => assert.fail("An unchanged inquiry must not be audited") },
      };
      const database = { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
      const result = await updateAdminInquiry(database, staff, hotelId, inquiryId, async () => ({ status, adminNote: " Follow-up " }));
      assert.deepEqual(result, { status: 200, body: { message: "No changes to save", inquiry } });
    });
  }

  it("audits a real note change without resetting timestamps when the status is unchanged", async () => {
    const inquiry = { id: inquiryId, status: "READ", adminNote: "Old note", subject: "Fixture" };
    const tx = {
      hotelInquiry: {
        findFirst: async () => inquiry,
        update: async ({ data }: Prisma.HotelInquiryUpdateArgs) => {
          assert.deepEqual(data, { adminNote: "New note" });
          return { ...inquiry, ...data };
        },
      },
      auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
        assert.deepEqual(data.metadata, { previousStatus: "READ", nextStatus: "READ", adminNoteChanged: true });
      } },
    };
    const database = { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
    const result = await updateAdminInquiry(database, staff, hotelId, inquiryId, async () => ({ status: "READ", adminNote: "New note" }));
    assert.equal(result.status, 200);
    assert.equal(Reflect.get(result.body, "inquiry").adminNote, "New note");
  });
});
