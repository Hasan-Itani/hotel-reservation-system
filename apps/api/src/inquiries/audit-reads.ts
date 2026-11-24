import type { Prisma, PrismaClient } from "@prisma/client";
import { buildAuditCategoryWhere, buildHotelAuditVisibilityWhere, normalizeAuditEventCategory } from "../common/audit-events";
import { canAccessHotel, hasGlobalRole, hasHotelRole, type AuthUser } from "../common/permissions";
import { activityResponse, type ActivityResult } from "./activity-response";

function canViewAudit(user: AuthUser, hotelId: string) {
  return (
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER")
  );
}

function normalizeLimit(value: string | null) {
  if (!value) return 100;

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return 100;

  return Math.min(Math.max(parsed, 1), 200);
}

export async function listHotelAudit(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  query: URLSearchParams,
): Promise<ActivityResult> {
  if (!user) return activityResponse({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessHotel(user, hotelId)) {
    return activityResponse({ error: "You do not have access to this hotel" }, { status: 403 });
  }
  if (!canViewAudit(user, hotelId)) {
    return activityResponse({ error: "Requires HOTEL_ADMIN or MANAGER role for this hotel" }, { status: 403 });
  }

  const hotel = await database.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!hotel) {
    return activityResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const action = query.get("action") || undefined;
  const entityType = query.get("entityType") || undefined;
  const actorUserId = query.get("actorUserId") || undefined;
  const reservationNumber = query.get("reservationNumber")?.trim().toUpperCase();
  const eventCategory = normalizeAuditEventCategory(
    query.get("eventCategory"),
  );
  const limit = normalizeLimit(query.get("limit"));
  const visibilityWhere = buildHotelAuditVisibilityWhere(hotelId);
  const whereConditions: Prisma.AuditLogWhereInput[] = [visibilityWhere];
  const categoryWhere = buildAuditCategoryWhere(eventCategory);

  if (categoryWhere) whereConditions.push(categoryWhere);
  if (action) whereConditions.push({ action });
  if (entityType) whereConditions.push({ entityType });
  if (actorUserId) whereConditions.push({ actorUserId });
  if (reservationNumber) {
    if (reservationNumber.length > 50) {
      return activityResponse({ error: "Invalid reservation number" }, { status: 400 });
    }
    whereConditions.push({ metadata: { path: ["reservationNumber"], equals: reservationNumber } });
  }

  const where: Prisma.AuditLogWhereInput = {
    AND: whereConditions,
  };

  const [logs, actionRows, entityTypeRows] = await Promise.all([
    database.auditLog.findMany({
      where,
      select: {
        id: true,
        hotelId: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    }),
    database.auditLog.findMany({
      where: visibilityWhere,
      distinct: ["action"],
      select: {
        action: true,
      },
      orderBy: {
        action: "asc",
      },
    }),
    database.auditLog.findMany({
      where: visibilityWhere,
      distinct: ["entityType"],
      select: {
        entityType: true,
      },
      orderBy: {
        entityType: "asc",
      },
    }),
  ]);

  return activityResponse({
    hotelId: hotel.id,
    hotelName: hotel.name,
    logs,
    filters: {
      actions: actionRows.map((item) => item.action),
      entityTypes: entityTypeRows.map((item) => item.entityType),
    },
  });
}
