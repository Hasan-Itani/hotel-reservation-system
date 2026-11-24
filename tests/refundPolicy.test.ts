import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canRefundReservation } from "../apps/api/src/admin-reservations/refund-policy";

describe("reservation refund cutoff", () => {
  const booking = {
    status: "CHECKED_IN",
    checkOutDate: new Date("2026-11-24T00:00:00Z"),
    hotel: { timezone: "Asia/Beirut" },
  };

  it("allows refunds on the checkout date until midnight in the hotel's timezone", () => {
    assert.equal(canRefundReservation(booking, new Date("2026-11-24T21:59:59Z")), true);
    assert.equal(canRefundReservation(booking, new Date("2026-11-24T22:00:00Z")), false);
  });

  it("blocks checked-out stays but keeps cancellation and no-show refunds available", () => {
    const beforeCheckout = new Date("2026-11-23T12:00:00Z");
    const afterCheckout = new Date("2026-12-01T12:00:00Z");
    assert.equal(canRefundReservation({ ...booking, status: "CHECKED_OUT" }, beforeCheckout), false);
    assert.equal(canRefundReservation({ ...booking, status: "CANCELLED" }, afterCheckout), true);
    assert.equal(canRefundReservation({ ...booking, status: "NO_SHOW" }, afterCheckout), true);
  });
});
