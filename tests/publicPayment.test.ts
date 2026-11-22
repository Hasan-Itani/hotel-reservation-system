import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaymentStatus, Prisma, ReservationStatus, type PrismaClient } from "@prisma/client";
import { submitPublicPayment } from "../apps/api/src/booking-domain/submit-public-payment";

const reservationNumber = "RSV-TEST-123";
const guest = { id: "test-guest" };
const getGuest = async () => guest;
const getAnonymous = async () => null;
const card = {
  cardHolderName: "Test Guest",
  cardNumber: "4242 4242 4242 4242",
  expiryMonth: 12,
  expiryYear: 2099,
  cvv: "123",
};

function paymentFixture() {
  const paymentWrites: Prisma.PaymentUncheckedCreateInput[] = [];
  const reservationUpdates: Prisma.ReservationUpdateInput[] = [];
  const lookups: Prisma.ReservationWhereInput[] = [];
  let status: ReservationStatus = ReservationStatus.PENDING;
  let confirmedAt: Date | null = null;
  const transaction = {
    reservation: {
      findFirst: async ({ where }: { where: Prisma.ReservationWhereInput }) => {
        lookups.push(where);
        if (!where.OR?.some((filter) => filter.userId === guest.id || filter.guestEmail === "guest@example.com")) {
          return null;
        }
        return {
          id: "test-booking",
          reservationNumber,
          status,
          confirmedAt,
          total: new Prisma.Decimal(1250),
          currency: "USD",
          payments: paymentWrites,
        };
      },
      update: async ({ data }: { data: Prisma.ReservationUpdateInput }) => {
        reservationUpdates.push(data);
        status = data.status as ReservationStatus;
        confirmedAt = data.confirmedAt as Date;
        return { status, confirmedAt };
      },
    },
    payment: {
      create: async ({ data }: { data: Prisma.PaymentUncheckedCreateInput }) => {
        paymentWrites.push(data);
        return { ...data, createdAt: new Date() };
      },
    },
  };
  const database = {
    $transaction: async (
      run: (client: typeof transaction) => Promise<unknown>,
      options: { isolationLevel: Prisma.TransactionIsolationLevel },
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      return run(transaction);
    },
  } as unknown as PrismaClient;
  return { database, paymentWrites, reservationUpdates, lookups };
}

describe("guest mock payment writes", () => {
  it("records a decline without changing the balance or reservation status", async () => {
    const { database, paymentWrites, reservationUpdates } = paymentFixture();
    const result = await submitPublicPayment(database, reservationNumber, { ...card, cardNumber: "4000000000000002" }, getGuest);
    assert.equal(result.status, 201);
    assert.ok("paymentSummary" in result.body);
    assert.equal(result.body.payment?.status, PaymentStatus.FAILED);
    assert.equal(result.body.reservationStatus, ReservationStatus.PENDING);
    assert.deepEqual(result.body.paymentSummary, { total: 1250, paid: 0, remaining: 1250 });
    assert.equal(paymentWrites.length, 1);
    assert.equal(reservationUpdates.length, 0);
  });

  it("keeps partial payments pending and confirms the booking only after the balance reaches zero", async () => {
    const { database, paymentWrites, reservationUpdates } = paymentFixture();
    const partial = await submitPublicPayment(database, reservationNumber, { ...card, amount: 250 }, getGuest);
    assert.equal(partial.status, 201);
    assert.ok("paymentSummary" in partial.body);
    assert.equal(partial.body.reservationStatus, ReservationStatus.PENDING);
    assert.deepEqual(partial.body.paymentSummary, { total: 1250, paid: 250, remaining: 1000 });
    assert.equal(reservationUpdates.length, 0);

    const full = await submitPublicPayment(database, reservationNumber, card, getGuest);
    assert.equal(full.status, 201);
    assert.ok("paymentSummary" in full.body);
    assert.equal(full.body.payment?.cardLast4, "4242");
    assert.equal(full.body.reservationStatus, ReservationStatus.CONFIRMED);
    assert.deepEqual(full.body.paymentSummary, { total: 1250, paid: 1250, remaining: 0 });
    assert.equal(reservationUpdates.length, 1);
    assert.ok(full.body.confirmedAt instanceof Date);
    assert.ok(paymentWrites.every((payment) => payment.isMock && !("cardNumber" in payment) && !("cvv" in payment)));

    const duplicate = await submitPublicPayment(database, reservationNumber, card, getGuest);
    assert.equal(duplicate.status, 409);
    assert.equal(paymentWrites.length, 2);
  });

  it("allows the matching guest email but rejects missing access, incorrect email, and overpayment", async () => {
    const { database, paymentWrites, lookups } = paymentFixture();
    assert.equal((await submitPublicPayment(database, reservationNumber, card, getAnonymous)).status, 400);
    assert.equal(lookups.length, 0);
    const invalidEmail = await submitPublicPayment(database, reservationNumber, { ...card, guestEmail: "wrong@example.com" }, getAnonymous);
    assert.equal(invalidEmail.status, 404);
    const overpayment = await submitPublicPayment(
      database,
      reservationNumber.toLowerCase(),
      { ...card, guestEmail: "Guest@Example.com", amount: 1250.01 },
      getAnonymous,
    );
    assert.equal(overpayment.status, 409);
    assert.ok("remainingBalance" in overpayment.body);
    assert.equal(overpayment.body.remainingBalance, 1250);
    assert.equal(paymentWrites.length, 0);
    assert.deepEqual(lookups.at(-1)?.OR, [{ guestEmail: "guest@example.com" }]);
    assert.equal(lookups.at(-1)?.reservationNumber, reservationNumber);
  });

  it("reports a transaction conflict without retrying the write", async () => {
    let attempts = 0;
    const database = {
      $transaction: async () => {
        attempts += 1;
        throw new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "test" });
      },
    } as unknown as PrismaClient;
    const result = await submitPublicPayment(database, reservationNumber, card, getGuest);
    assert.equal(result.status, 409);
    assert.equal(attempts, 1);
  });
});
