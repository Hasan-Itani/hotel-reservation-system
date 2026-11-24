import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPartialPaymentReceipt, tryPartialPaymentReceipt } from "../apps/api/src/booking-domain/partial-payment-receipt";
import type { TransactionalEmail } from "../apps/api/src/common/resend-sender";

describe("partial payment receipts", () => {
  it("only creates a receipt event for a paid payment with a balance remaining", () => {
    const payment = { id: "payment-1", status: "PAID" };
    assert.deepEqual(getPartialPaymentReceipt(payment, 170), { paymentId: "payment-1", remaining: 170 });
    assert.equal(getPartialPaymentReceipt(payment, 0), undefined);
    assert.equal(getPartialPaymentReceipt({ ...payment, status: "FAILED" }, 170), undefined);
  });

  it("sends the recorded payment and the transaction's balance to the booked guest", async () => {
    const database = {
      payment: { findUnique: async ({ where }: Prisma.PaymentFindUniqueArgs) => {
        assert.deepEqual(where, { id: "payment-1", status: "PAID" });
        return {
          amount: new Prisma.Decimal(50),
          currency: "USD",
          isMock: true,
          reservation: {
            reservationNumber: "RSV-TEST", guestEmail: "guest@example.com", hotel: { name: "Test Hotel" },
          },
        };
      } },
    } as unknown as Pick<PrismaClient, "payment">;
    const sent: Array<{ message: TransactionalEmail; key: string }> = [];
    await tryPartialPaymentReceipt(database, { paymentId: "payment-1", remaining: 170 }, async (message, key) => {
      sent.push({ message, key });
    });
    assert.equal(sent.length, 1);
    const [{ message, key }] = sent;
    assert.equal(message.to, "guest@example.com");
    assert.equal(message.subject, "[TEST] Partial payment received: RSV-TEST");
    assert.equal(key, "booking-partial-payment/payment-1");
    assert.match(message.text, /Amount paid this time: \$50\.00 USD/);
    assert.match(message.text, /Balance after this payment: \$170\.00 USD/);
    assert.match(message.text, /No real charge was made/);
  });
});
