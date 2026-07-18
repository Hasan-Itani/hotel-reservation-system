import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_EVENT_CATEGORIES,
  AUTH_SECURITY_AUDIT_ACTIONS,
  buildAuditCategoryWhere,
  buildHotelAuditVisibilityWhere,
  isAuthSecurityAuditAction,
  normalizeAuditEventCategory,
} from "../lib/auditEvents";

describe("audit event filters", () => {
  it("recognizes authentication and security actions", () => {
    for (const action of AUTH_SECURITY_AUDIT_ACTIONS) {
      assert.equal(isAuthSecurityAuditAction(action), true);
    }

    assert.equal(isAuthSecurityAuditAction("ROOM_UPDATED"), false);
  });

  it("normalizes supported event categories", () => {
    assert.equal(
      normalizeAuditEventCategory("AUTH_SECURITY"),
      AUDIT_EVENT_CATEGORIES.AUTH_SECURITY,
    );
    assert.equal(normalizeAuditEventCategory("UNKNOWN"), undefined);
    assert.equal(normalizeAuditEventCategory(null), undefined);
  });

  it("builds the authentication and security category condition", () => {
    assert.deepEqual(
      buildAuditCategoryWhere(AUDIT_EVENT_CATEGORIES.AUTH_SECURITY),
      {
        action: {
          in: [...AUTH_SECURITY_AUDIT_ACTIONS],
        },
      },
    );
    assert.equal(buildAuditCategoryWhere(undefined), null);
  });

  it("limits global security events to users connected to the hotel", () => {
    const hotelId = "hotel-123";

    assert.deepEqual(buildHotelAuditVisibilityWhere(hotelId), {
      OR: [
        { hotelId },
        {
          hotelId: null,
          action: {
            in: [...AUTH_SECURITY_AUDIT_ACTIONS],
          },
          actor: {
            is: {
              OR: [
                {
                  reservations: {
                    some: { hotelId },
                  },
                },
                {
                  UserHotelRole: {
                    some: { hotelId },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  });
});