import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roomTypeCreateSchema } from "../apps/api/src/admin-rooms/room-schemas";
import { formatApiError, readApiError } from "../lib/frontend/api-error";
import { clientFetchJson, FrontendApiError } from "../lib/frontend/api-client";

describe("frontend API errors", () => {
  it("shows the actual room-type slug validation error in the shared browser client", async (context) => {
    const result = roomTypeCreateSchema.safeParse({
      name: "Test Suite 1234",
      slug: "test-suite 1234",
      basePrice: 130,
      capacityAdults: 2,
    });
    assert.equal(result.success, false);
    if (result.success) return;

    context.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: "Validation failed", details: result.error.flatten() }, { status: 400 }),
    );
    await assert.rejects(clientFetchJson("/test-room-types"), (error) => {
      assert.ok(error instanceof FrontendApiError);
      assert.equal(error.status, 400);
      assert.equal(error.message, "Slug must contain only lowercase letters, numbers, and hyphens");
      return true;
    });
  });

  it("includes multiple field problems and form-level validation messages", () => {
    const message = formatApiError(422, {
      error: "Validation failed",
      details: {
        fieldErrors: {
          guestEmail: ["Invalid email address"],
          roomNumber: ["Invalid input: expected string, received undefined"],
        },
        formErrors: ["Provide at least one room."],
      },
    });
    assert.equal(message, "Guest Email: Invalid email address. Room Number is required. Provide at least one room.");
  });

  it("preserves application errors and recognizes the NestJS validation envelope", () => {
    assert.equal(formatApiError(409, { error: "This slug is already in use." }), "This slug is already in use.");
    assert.equal(formatApiError(400, { message: ["Name is required.", "Price cannot be negative."] }), "Name is required. Price cannot be negative.");
    const emailError = "We could not send the verification email right now. Please try again later.";
    assert.equal(formatApiError(503, { error: emailError }), emailError);
  });

  it("gives readable fallbacks for bare errors and non-JSON responses", async () => {
    assert.equal(formatApiError(403, { error: "Forbidden" }), "You do not have permission to do that.");
    assert.equal(formatApiError(400, { error: "Validation failed", details: {} }), "Check the information you entered and try again.");
    assert.equal(formatApiError(500, { message: "Unexpected internal details" }), "We could not complete the request. Please try again.");
    assert.equal(await readApiError(new Response("<html></html>", { status: 502 })), "We could not complete the request. Please try again.");
  });
});
