import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHotelInventoryAdvisoryLockKey } from "../../lib/reservationConcurrency";

describe("reservation concurrency helpers", () => {
  it("generates stable advisory lock keys for the same hotel", () => {
    const firstKey = getHotelInventoryAdvisoryLockKey("hotel-1");
    const secondKey = getHotelInventoryAdvisoryLockKey("hotel-1");

    assert.deepEqual(firstKey, secondKey);
  });

  it("generates different advisory lock keys for different hotels", () => {
    const firstKey = getHotelInventoryAdvisoryLockKey("hotel-1");
    const secondKey = getHotelInventoryAdvisoryLockKey("hotel-2");

    assert.notEqual(firstKey.key, secondKey.key);
    assert.equal(firstKey.namespace, secondKey.namespace);
  });
});
