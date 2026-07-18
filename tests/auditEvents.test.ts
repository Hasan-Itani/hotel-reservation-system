import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_ACTIONS_BY_CATEGORY,
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_CATEGORY_OPTIONS,
  AUTH_SECURITY_AUDIT_ACTIONS,
  buildAuditCategoryWhere,
  buildHotelAuditVisibilityWhere,
  getAuditActionsForCategory,
  isAuditActionInCategory,
  normalizeAuditEventCategory,
} from "../lib/auditEvents";

describe("audit event filters", () => {
  it("defines a label and action list for every activity area", () => {
    const categories = Object.values(AUDIT_EVENT_CATEGORIES);

    assert.deepEqual(
      AUDIT_EVENT_CATEGORY_OPTIONS.map((option) => option.value),
      categories,
    );

    for (const category of categories) {
      assert.ok(AUDIT_ACTIONS_BY_CATEGORY[category].length > 0);
    }
  });

  it("keeps actions in one activity area", () => {
    const actions = Object.values(AUDIT_ACTIONS_BY_CATEGORY).flat();

    assert.equal(new Set(actions).size, actions.length);
  });

  it("recognizes actions in their category", () => {
    assert.equal(
      isAuditActionInCategory(
        "ACCOUNT_LOCKED",
        AUDIT_EVENT_CATEGORIES.AUTH_SECURITY,
      ),
      true,
    );
    assert.equal(
      isAuditActionInCategory(
        "ROOM_UPDATED",
        AUDIT_EVENT_CATEGORIES.ROOMS_INVENTORY,
      ),
      true,
    );
    assert.equal(
      isAuditActionInCategory(
        "ROOM_UPDATED",
        AUDIT_EVENT_CATEGORIES.PAYMENTS,
      ),
      false,
    );
  });

  it("normalizes all supported event categories", () => {
    for (const category of Object.values(AUDIT_EVENT_CATEGORIES)) {
      assert.equal(normalizeAuditEventCategory(category), category);
    }

    assert.equal(normalizeAuditEventCategory("UNKNOWN"), undefined);
    assert.equal(normalizeAuditEventCategory(null), undefined);
  });

  it("builds category conditions from the shared action lists", () => {
    assert.deepEqual(
      buildAuditCategoryWhere(AUDIT_EVENT_CATEGORIES.PAYMENTS),
      {
        action: {
          in: [...AUDIT_ACTIONS_BY_CATEGORY.PAYMENTS],
        },
      },
    );
    assert.equal(getAuditActionsForCategory(undefined), null);
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