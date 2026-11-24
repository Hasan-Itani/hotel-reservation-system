import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PaymentStatus, type PrismaClient, type ReservationStatus } from "@prisma/client";
import { createAdminMockPayment, updateAdminPaymentStatus } from "../apps/api/src/admin-reservations/payment-writes";
import type { AuthUser } from "../lib/permissions";

const hotelId = "fixture-hotel";
const reservationId = "fixture-reservation";
const paymentId = "fixture-payment";
const staff: AuthUser = {
  id: "fixture-staff",
  firstName: "Test",
  lastName: "Staff",
  email: "staff@example.com",
  status: "ACTIVE",
  globalRoles: [],
  hotelRoles: [{ hotelId, hotelName: "Test Hotel", role: "RECEPTIONIST" }],
};
const card = {
  cardHolderName: "Test Guest",
  cardNumber: "4242424242424242",
  expiryMonth: 12,
  expiryYear: 2099,
  cvv: "123",
};

function fixture(priorConfirmation = false) {
  let reservationStatus: ReservationStatus = "PENDING";
  let paymentStatus: PaymentStatus = "FAILED";
  let paidAt: Date | null = null;
  const amount = new Prisma.Decimal(1250);
  let recordedAmount = amount;
  let created = false;
  const audits: Prisma.AuditLogUncheckedCreateInput[] = [];
  const reservation = () => ({
    id: reservationId,
    reservationNumber: "RSV-FIXTURE",
    status: reservationStatus,
    total: amount,
    currency: "USD",
    confirmedAt: null,
    paidConfirmationEmailAttemptedAt: priorConfirmation ? new Date() : null,
    payments: created ? [{ id: paymentId, amount: recordedAmount, status: paymentStatus }] : [],
  });
  const payment = () => ({ id: paymentId, status: paymentStatus, paidAt, amount: recordedAmount, currency: "USD", provider: "MOCK_CARD" });
  const transaction = {
    reservation: {
      findFirst: async ({ where }: Prisma.ReservationFindFirstArgs) => {
        assert.deepEqual(where, { id: reservationId, hotelId });
        return reservation();
      },
      update: async ({ data }: Prisma.ReservationUpdateArgs) => {
        reservationStatus = data.status as ReservationStatus;
        return reservation();
      },
    },
    payment: {
      findFirst: async ({ where }: Prisma.PaymentFindFirstArgs) => {
        assert.deepEqual(where, { id: paymentId, reservationId, reservation: { hotelId } });
        return created ? { ...payment(), reservation: reservation() } : null;
      },
      create: async ({ data }: { data: Prisma.PaymentUncheckedCreateInput }) => {
        assert.equal(data.isMock, true);
        assert.equal(data.reservationId, reservationId);
        recordedAmount = new Prisma.Decimal(String(data.amount));
        assert.equal("cardNumber" in data || "cvv" in data, false);
        paymentStatus = data.status as PaymentStatus;
        paidAt = data.paidAt as Date | null;
        created = true;
        return payment();
      },
      update: async ({ data }: Prisma.PaymentUpdateArgs) => {
        paymentStatus = data.status as PaymentStatus;
        paidAt = data.paidAt as Date | null;
        return payment();
      },
    },
    auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => audits.push(data) },
  };
  const database = {
    $transaction: async (run: (client: typeof transaction) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, "Serializable");
      return run(transaction);
    },
  } as unknown as PrismaClient;
  return { database, reservation, payment, audits };
}

describe("admin payment writes", () => {
  it("returns a full-payment receipt after a booking with a prior confirmation is refunded and repaid", async () => {
    const { database } = fixture(true);
    const create = () => createAdminMockPayment(database, staff, hotelId, reservationId, async () => card);
    assert.equal((await create()).status, 201);
    assert.equal((await updateAdminPaymentStatus(database, staff, hotelId, reservationId, paymentId, async () => ({
      action: "MARK_REFUNDED",
    }))).status, 200);
    const repaid = await create();
    assert.equal(repaid.status, 201);
    assert.deepEqual(repaid.paymentReceipt, { paymentId, remaining: 0 });
  });

  it("rejects missing sessions, wrong hotels, and read-only roles before parsing the body", async () => {
    const database = {} as PrismaClient;
    const unread = async () => assert.fail("Unauthorized requests must not be processed");
    assert.equal((await createAdminMockPayment(database, null, hotelId, reservationId, unread)).status, 401);
    assert.equal((await createAdminMockPayment(database, staff, "other-hotel", reservationId, unread)).status, 403);
    const housekeeping = { ...staff, hotelRoles: [{ ...staff.hotelRoles[0], role: "HOUSEKEEPING" }] };
    assert.equal((await updateAdminPaymentStatus(database, housekeeping, hotelId, reservationId, paymentId, unread)).status, 403);
  });

  it("records a declined mock payment, marks it paid, blocks overpayment, and audits a refund", async () => {
    const { database, reservation, payment, audits } = fixture();
    const create = (body: unknown) => createAdminMockPayment(database, staff, hotelId, reservationId, async () => body);
    const update = (action: string) => updateAdminPaymentStatus(database, staff, hotelId, reservationId, paymentId, async () => ({ action }));

    assert.equal((await create({ ...card, amount: 1250.01 })).status, 409);
    assert.equal(audits.length, 0);
    const declined = await create({ ...card, cardNumber: "4000000000000000" });
    assert.equal(declined.status, 201);
    assert.equal(declined.paymentReceipt, undefined);
    assert.equal(payment().status, "FAILED");
    assert.equal(reservation().status, "PENDING");
    const fullyPaid = await update("MARK_PAID");
    assert.equal(fullyPaid.status, 200);
    assert.equal(fullyPaid.paymentReceipt, undefined);
    assert.equal(payment().status, "PAID");
    assert.equal(reservation().status, "CONFIRMED");
    assert.equal((await create(card)).status, 409);
    assert.equal((await update("MARK_REFUNDED")).status, 200);
    assert.equal(payment().status, "REFUNDED");
    assert.equal((await update("MARK_REFUNDED")).status, 409);
    assert.deepEqual(audits.map(({ action, actorUserId }) => [action, actorUserId]), [
      ["PAYMENT_CREATED", staff.id],
      ["PAYMENT_STATUS_UPDATED", staff.id],
      ["PAYMENT_STATUS_UPDATED", staff.id],
    ]);
  });

  it("returns a conflict without automatically retrying a concurrent write", async () => {
    let attempts = 0;
    const database = {
      $transaction: async () => {
        attempts += 1;
        throw new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "test" });
      },
    } as unknown as PrismaClient;
    const response = await createAdminMockPayment(database, staff, hotelId, reservationId, async () => card);
    assert.equal(response.status, 409);
    assert.equal(attempts, 1);
  });

  it("returns the same partial receipt data when staff records a payment or marks it paid", async () => {
    const expected = { paymentId, remaining: 1000 };
    const partialCard = { ...card, amount: 250 };
    const direct = fixture();
    const created = await createAdminMockPayment(direct.database, staff, hotelId, reservationId, async () => partialCard);
    assert.deepEqual(created.paymentReceipt, expected);

    const manual = fixture();
    await createAdminMockPayment(manual.database, staff, hotelId, reservationId, async () => ({
      ...partialCard, cardNumber: "4000000000000000",
    }));
    const marked = await updateAdminPaymentStatus(manual.database, staff, hotelId, reservationId, paymentId, async () => ({
      action: "MARK_PAID",
    }));
    assert.deepEqual(marked.paymentReceipt, expected);
  });
});
