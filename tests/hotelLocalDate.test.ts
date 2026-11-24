import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasReachedCheckInDate } from "../apps/api/src/booking-domain/hotel-local-date";

describe("hotel-local check-in date", () => {
  it("opens check-in at local midnight on the scheduled arrival date", () => {
    const arrival = new Date("2026-11-24");
    const instant = new Date("2026-11-23T22:00:00Z");
    assert.equal(hasReachedCheckInDate(arrival, "Asia/Beirut", new Date("2026-11-23T21:59:59Z")), false);
    assert.equal(hasReachedCheckInDate(arrival, "Asia/Beirut", instant), true);
    assert.equal(hasReachedCheckInDate(arrival, "UTC", instant), false);
  });
});
