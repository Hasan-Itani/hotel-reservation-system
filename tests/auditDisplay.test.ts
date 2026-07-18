import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isIsoDateTimeString } from "../lib/auditDisplay";

describe("audit display helpers", () => {
  it("recognizes ISO date-time values", () => {
    assert.equal(isIsoDateTimeString("2026-07-18T14:15:43.914Z"), true);
    assert.equal(isIsoDateTimeString("2026-07-18T17:15:43+03:00"), true);
  });

  it("does not treat ordinary audit values as dates", () => {
    assert.equal(isIsoDateTimeString("guest@example.com"), false);
    assert.equal(isIsoDateTimeString("ACCOUNT_UNLOCKED"), false);
    assert.equal(isIsoDateTimeString("2026-07-18"), false);
  });
});