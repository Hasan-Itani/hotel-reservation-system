import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getUnmetPasswordRequirements,
  meetsPasswordPolicy,
  PASSWORD_MAX_LENGTH,
} from "../lib/passwordPolicy";
import { guestRegisterSchema, resetPasswordSchema } from "../lib/validators";

describe("password policy", () => {
  it("accepts a password that meets every requirement", () => {
    assert.equal(meetsPasswordPolicy("HotelGuest!2026"), true);
    assert.deepEqual(getUnmetPasswordRequirements("HotelGuest!2026"), []);
  });

  it("reports each missing composition requirement", () => {
    const missingRequirementIds = getUnmetPasswordRequirements("short").map(
      (requirement) => requirement.id,
    );

    assert.deepEqual(missingRequirementIds, [
      "length",
      "uppercase",
      "number",
      "symbol",
    ]);
  });

  it("enforces the policy in registration and reset API schemas", () => {
    const registration = guestRegisterSchema.safeParse({
      firstName: "Test",
      lastName: "Guest",
      email: "guest@example.com",
      phone: "",
      password: "password",
    });
    const reset = resetPasswordSchema.safeParse({
      token: "a".repeat(32),
      password: "password",
    });

    assert.equal(registration.success, false);
    assert.equal(reset.success, false);
  });

  it("rejects passwords longer than the supported maximum", () => {
    const password = `HotelGuest!2026${"a".repeat(PASSWORD_MAX_LENGTH)}`;

    assert.equal(meetsPasswordPolicy(password), false);
  });
});