import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPasswordResetAccountRateLimitKey,
  getPasswordResetIpRateLimitKey,
} from "../lib/authRateLimit";

describe("authentication rate-limit keys", () => {
  it("scopes password reset limits to a normalized email", () => {
    assert.equal(
      getPasswordResetAccountRateLimitKey(" Guest@Example.com "),
      "forgot-password-account:guest@example.com",
    );
    assert.notEqual(
      getPasswordResetAccountRateLimitKey("first@example.com"),
      getPasswordResetAccountRateLimitKey("second@example.com"),
    );
  });

  it("keeps a separate network abuse key", () => {
    assert.equal(
      getPasswordResetIpRateLimitKey("127.0.0.1"),
      "forgot-password-ip:127.0.0.1",
    );
  });
});