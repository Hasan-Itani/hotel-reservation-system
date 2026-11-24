import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPaymentReceipt, tryPaymentReceipt } from "../apps/api/src/booking-domain/payment-receipt";
import type { TransactionalEmail } from "../apps/api/src/common/resend-sender";

describe("partial payment receipts", () => {
  it("creates receipts for partial payments and subsequent payments that clear the balance", () => {
    const payment = { id: "payment-1", status: "PAID" };
    assert.deepEqual(getPaymentReceipt(payment, 170, false), { paymentId: "payment-1", remaining: 170 });
    assert.equal(getPaymentReceipt(payment, 0, false), undefined);
    assert.deepEqual(getPaymentReceipt(payment, 0, true), { paymentId: "payment-1", remaining: 0 });
    assert.equal(getPaymentReceipt({ ...payment, status: "FAILED" }, 170, true), undefined);
  });

  it("formats both partial and full receipts using the transaction's balance", async () => {
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
    await tryPaymentReceipt(database, { paymentId: "payment-1", remaining: 170 }, async (message, key) => {
      sent.push({ message, key });
    });
    await tryPaymentReceipt(database, { paymentId: "payment-1", remaining: 0 }, async (message, key) => {
      sent.push({ message, key });
    });
    assert.equal(sent.length, 2);
    const [{ message, key }, full] = sent;
    assert.equal(message.to, "guest@example.com");
    assert.equal(message.subject, "[TEST] Partial payment received: RSV-TEST");
    assert.equal(key, "booking-partial-payment/payment-1");
    assert.match(message.text, /Amount paid this time: \$50\.00 USD/);
    assert.match(message.text, /Balance after this payment: \$170\.00 USD/);
    assert.match(message.text, /No real charge was made/);
    assert.equal(full.message.subject, "[TEST] Payment received: RSV-TEST");
    assert.equal(full.key, "booking-payment/payment-1");
    assert.match(full.message.text, /Balance after this payment: \$0\.00 USD/);
  });
});
