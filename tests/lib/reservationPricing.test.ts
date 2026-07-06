import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateReservationPricing } from "../../lib/reservationPricing";

describe("calculateReservationPricing", () => {
  it("calculates subtotal and total for multiple rooms across multiple nights", () => {
    const result = calculateReservationPricing({
      nights: 3,
      rooms: [
        { roomTypeId: "standard", guests: 2 },
        { roomTypeId: "suite", guests: 2 },
      ],
      roomTypeMap: new Map([
        ["standard", { basePrice: 100 }],
        ["suite", { basePrice: 250 }],
      ]),
      taxes: 30,
      serviceFee: 20,
      discountAmount: 50,
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(result.subtotal, 1050);
    assert.equal(result.taxes, 30);
    assert.equal(result.serviceFee, 20);
    assert.equal(result.discountAmount, 50);
    assert.equal(result.total, 1050);
  });

  it("rejects reservations shorter than one night", () => {
    const result = calculateReservationPricing({
      nights: 0,
      rooms: [{ roomTypeId: "standard", guests: 1 }],
      roomTypeMap: new Map([["standard", { basePrice: 100 }]]),
    });

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Reservation must be at least 1 night");
  });

  it("rejects missing room type pricing data", () => {
    const result = calculateReservationPricing({
      nights: 2,
      rooms: [{ roomTypeId: "missing", guests: 1 }],
      roomTypeMap: new Map(),
    });

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.status, 400);
    assert.equal(result.body.roomTypeId, "missing");
  });

  it("rejects totals below zero", () => {
    const result = calculateReservationPricing({
      nights: 1,
      rooms: [{ roomTypeId: "standard", guests: 1 }],
      roomTypeMap: new Map([["standard", { basePrice: 100 }]]),
      discountAmount: 150,
    });

    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Total cannot be negative");
  });
});
