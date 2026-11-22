import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLoginRedirectPath } from "../lib/frontend/login-redirect";
import type { AuthUser } from "../lib/frontend/types";

const guest: AuthUser = {
  id: "guest-fixture",
  firstName: "Test",
  lastName: "Guest",
  email: "guest@example.invalid",
  phone: null,
  status: "ACTIVE",
  emailVerifiedAt: null,
  globalRoles: [],
  hotelRoles: [],
};

const staff: AuthUser = {
  ...guest,
  hotelRoles: [{ hotelId: "hotel-one", hotelName: "Test Hotel", role: "RECEPTIONIST" }],
};

describe("login redirects", () => {
  it("defaults hotel staff and global admins to the admin dashboard", () => {
    assert.equal(getLoginRedirectPath(staff, null), "/admin");
    assert.equal(
      getLoginRedirectPath({ ...guest, globalRoles: ["SUPER_ADMIN"] }, undefined),
      "/admin",
    );
  });

  it("defaults guests to their account and keeps intentional guest destinations", () => {
    const booking = "/hotels/test-hotel/book?adults=2";
    assert.equal(getLoginRedirectPath(guest, undefined), "/guest/account");
    assert.equal(getLoginRedirectPath(guest, booking), booking);
    assert.equal(getLoginRedirectPath(staff, booking), booking);
    assert.equal(getLoginRedirectPath(staff, "/guest/account"), "/guest/account");
  });

  it("only honors admin destinations permitted by the account role and hotel", () => {
    const reservations = "/admin/reservations?hotelId=hotel-one";
    assert.equal(getLoginRedirectPath(guest, reservations), "/guest/account");
    assert.equal(getLoginRedirectPath(staff, reservations), reservations);
    assert.equal(getLoginRedirectPath(staff, "/admin/reservations?hotelId=other"), "/admin");
    assert.equal(getLoginRedirectPath(staff, "/admin/staff?hotelId=hotel-one"), "/admin");
  });

  it("falls back for external targets, malformed inputs and sign-in loops", () => {
    for (const target of [
      "https://outside.example",
      "/\\outside.example",
      "/path/..//outside.example",
      ["/admin", "/guest/account"],
      "/guest/login?next=/admin",
      "/login",
    ]) {
      assert.equal(getLoginRedirectPath(staff, target), "/admin");
    }
  });
});
