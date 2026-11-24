import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildHotelAuditVisibilityWhere } from "../apps/api/src/common/audit-events";
import { getResendSender } from "../apps/api/src/common/resend-sender";
import { listHotelAudit } from "../apps/api/src/inquiries/audit-reads";

const context = {
  hotelId: "hotel-one", reservationId: "booking-one", reservationNumber: "RSV-NOTICE",
  emailType: "Cancellation notice",
} as const;
const message = { to: "guest@example.com", subject: "Private subject", text: "Private body" };
const settings = new Map([["RESEND_API_KEY", "private-key"], ["EMAIL_FROM", "hotel@example.com"]]);
const config = {
  get: (key: string) => settings.get(key),
} as ConfigService;

describe("booking email notification history", () => {
  it("records acceptance and rejection without storing email contents, recipient, or credentials", async () => {
    const entries: Prisma.AuditLogUncheckedCreateInput[] = [];
    const audit = {
      auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => { entries.push(data); } },
    } as unknown as Pick<PrismaClient, "auditLog">;
    const accepted = getResendSender(config, audit, async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "booking-cancelled/booking-one");
      return new Response(null, { status: 200 });
    });
    const rejected = getResendSender(config, audit, async () => new Response("private provider body", { status: 422 }));
    const timedOut = getResendSender(config, audit, async () => { throw new Error("private network detail"); });
    assert.ok(accepted && rejected && timedOut);

    await accepted(message, "booking-cancelled/booking-one", context);
    await assert.rejects(rejected(message, "booking-cancelled/booking-one", context), /422/);
    await assert.rejects(timedOut(message, "booking-cancelled/booking-one", context), /private network detail/);
    assert.deepEqual(entries.map(({ action }) => action), [
      "EMAIL_ACCEPTED_BY_RESEND", "EMAIL_SEND_FAILED", "EMAIL_SEND_FAILED",
    ]);
    assert.ok(entries.every(({ entityId, hotelId }) => entityId === context.reservationId && hotelId === context.hotelId));
    assert.deepEqual(entries[0].metadata, {
      reservationNumber: context.reservationNumber, emailType: context.emailType,
      outcome: "Accepted by Resend (delivery not verified)", providerStatus: 200,
    });
    assert.match(entries[2].summary, /no response from Resend/);
    assert.doesNotMatch(JSON.stringify(entries), /@example\.com|private/i);
  });

  it("does not change provider acceptance when the audit write fails", async () => {
    const audit = {
      auditLog: { create: async () => { throw new Error("Audit unavailable"); } },
    } as unknown as Pick<PrismaClient, "auditLog">;
    const send = getResendSender(config, audit, async () => new Response(null, { status: 200 }));
    assert.ok(send);
    await assert.doesNotReject(send(message, "booking-cancelled/booking-one", context));
  });

  it("filters notification history by hotel, email category, and exact normalized reservation number", async () => {
    const calls: Prisma.AuditLogFindManyArgs[] = [];
    const database = {
      hotel: { findFirst: async () => ({ id: context.hotelId, name: "Test Hotel" }) },
      auditLog: { findMany: async (args: Prisma.AuditLogFindManyArgs) => { calls.push(args); return []; } },
    } as unknown as PrismaClient;
    const manager = {
      id: "manager", email: "manager@example.com", firstName: "Test", lastName: "Manager", status: "ACTIVE",
      globalRoles: [], hotelRoles: [{ hotelId: context.hotelId, hotelName: "Test Hotel", role: "MANAGER" }],
    };
    const query = new URLSearchParams({ eventCategory: "EMAIL_NOTIFICATIONS", reservationNumber: " rsv-notice " });
    assert.equal((await listHotelAudit(database, manager, "other-hotel", query)).status, 403);
    assert.equal(calls.length, 0);
    assert.equal((await listHotelAudit(database, manager, context.hotelId, query)).status, 200);
    assert.deepEqual(calls[0].where, { AND: [
      buildHotelAuditVisibilityWhere(context.hotelId),
      { action: { in: ["EMAIL_ACCEPTED_BY_RESEND", "EMAIL_SEND_FAILED"] } },
      { metadata: { path: ["reservationNumber"], equals: context.reservationNumber } },
    ] });
  });
});
