import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOCKING_RESERVATION_STATUSES,
  SELLABLE_ROOM_STATUSES,
  generateReservationNumber,
  getNightCount,
  parseDateOnlyToUtc,
} from "../../lib/hotelInventory";

describe("hotel inventory helpers", () => {
  it("parses date-only strings as midnight UTC", () => {
    const parsed = parseDateOnlyToUtc("2026-07-06");

    assert.equal(parsed.toISOString(), "2026-07-06T00:00:00.000Z");
  });

  it("calculates night count from check-in and check-out dates", () => {
    assert.equal(getNightCount("2026-07-06", "2026-07-09"), 3);
  });

  it("returns zero or negative night counts for invalid date order", () => {
    assert.equal(getNightCount("2026-07-06", "2026-07-06"), 0);
    assert.equal(getNightCount("2026-07-07", "2026-07-06"), -1);
  });

  it("generates reservation numbers with the expected prefix and date", () => {
    const reservationNumber = generateReservationNumber();

    assert.match(reservationNumber, /^RSV-\d{8}-[A-Z0-9]{6}$/);
  });

  it("keeps pending, confirmed, and checked-in reservations as availability blockers", () => {
    assert.deepEqual([...BLOCKING_RESERVATION_STATUSES], [
      "PENDING",
      "CONFIRMED",
      "CHECKED_IN",
    ]);
  });

  it("keeps available, occupied, and cleaning rooms as sellable inventory", () => {
    assert.deepEqual([...SELLABLE_ROOM_STATUSES], [
      "AVAILABLE",
      "OCCUPIED",
      "CLEANING",
    ]);
  });
});
