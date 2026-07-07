import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { hasGlobalRole, hasHotelRole, type AuthUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  if (!canViewAudit(auth.user, hotelId)) {
    return NextResponse.json(
      {
        error: "Requires HOTEL_ADMIN or MANAGER role for this hotel",
      },
      { status: 403 },
    );
  }

  const hotel = await prisma.hotel.findFirst({
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
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || undefined;
  const entityType = url.searchParams.get("entityType") || undefined;
  const actorUserId = url.searchParams.get("actorUserId") || undefined;
  const limit = normalizeLimit(url.searchParams.get("limit"));

  const where = {
    hotelId,
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actorUserId ? { actorUserId } : {}),
  };

  const [logs, actionRows, entityTypeRows] = await Promise.all([
    prisma.auditLog.findMany({
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
    prisma.auditLog.findMany({
      where: {
        hotelId,
      },
      distinct: ["action"],
      select: {
        action: true,
      },
      orderBy: {
        action: "asc",
      },
    }),
    prisma.auditLog.findMany({
      where: {
        hotelId,
      },
      distinct: ["entityType"],
      select: {
        entityType: true,
      },
      orderBy: {
        entityType: "asc",
      },
    }),
  ]);

  return NextResponse.json({
    hotelId: hotel.id,
    hotelName: hotel.name,
    logs,
    filters: {
      actions: actionRows.map((item) => item.action),
      entityTypes: entityTypeRows.map((item) => item.entityType),
    },
  });
}
