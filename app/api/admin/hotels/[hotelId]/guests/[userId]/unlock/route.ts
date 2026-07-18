import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/auditLog";
import { requireHotelRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; userId: string }>;
  },
) {
  const { hotelId, userId } = await params;

  const auth = await requireHotelRole(hotelId, "HOTEL_ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.user.id === userId) {
    return NextResponse.json(
      { error: "You cannot unlock your own account from this page" },
      { status: 409 },
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

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      reservations: {
        some: {
          hotelId,
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      userRoles: {
        select: {
          id: true,
        },
      },
      UserHotelRole: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Linked guest account not found for this hotel" },
      { status: 404 },
    );
  }

  if (user.userRoles.length > 0 || user.UserHotelRole.length > 0) {
    return NextResponse.json(
      {
        error:
          "Staff or admin accounts must be unlocked through staff account controls",
      },
      { status: 409 },
    );
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Only active guest accounts can be unlocked" },
      { status: 409 },
    );
  }

  if (!user.lockedUntil || user.lockedUntil <= new Date()) {
    return NextResponse.json(
      {
        message: "Guest account is not currently locked",
        guest: {
          id: user.id,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil?.toISOString() ?? null,
        },
      },
    );
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: {
        increment: 1,
      },
    },
    select: {
      id: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  await createAuditLog({
    hotelId,
    actorUserId: auth.user.id,
    action: "ACCOUNT_UNLOCKED",
    entityType: "User",
    entityId: user.id,
    summary: `${user.firstName} ${user.lastName}'s guest account was unlocked`,
    metadata: {
      guestName: `${user.firstName} ${user.lastName}`,
      guestEmail: user.email,
      previousLockedUntil: user.lockedUntil.toISOString(),
    },
  });

  return NextResponse.json({
    message: "Guest account unlocked successfully",
    guest: {
      id: updatedUser.id,
      failedLoginAttempts: updatedUser.failedLoginAttempts,
      lockedUntil: updatedUser.lockedUntil?.toISOString() ?? null,
    },
  });
}
