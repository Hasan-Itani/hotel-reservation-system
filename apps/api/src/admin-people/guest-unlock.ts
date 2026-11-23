import type { PrismaClient } from "@prisma/client";
import { createAuditLog } from "../common/audit-log";
import type { AuthUser } from "../common/permissions";
import { getHotelAdminDenial, getHotelById, peopleResponse, type PeopleResult } from "./people-reads";

export async function unlockAdminGuest(
  database: PrismaClient,
  actor: AuthUser | null,
  hotelId: string,
  userId: string,
): Promise<PeopleResult> {
  const denied = getHotelAdminDenial(actor, hotelId);
  if (denied) return denied;
  if (!actor) return peopleResponse({ error: "Unauthorized" }, { status: 401 });

  if (actor.id === userId) {
    return peopleResponse(
      { error: "You cannot unlock your own account from this page" },
      { status: 409 },
    );
  }

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return peopleResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const user = await database.user.findFirst({
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
    return peopleResponse(
      { error: "Linked guest account not found for this hotel" },
      { status: 404 },
    );
  }

  if (user.userRoles.length > 0 || user.UserHotelRole.length > 0) {
    return peopleResponse(
      {
        error:
          "Staff or admin accounts must be unlocked through staff account controls",
      },
      { status: 409 },
    );
  }

  if (user.status !== "ACTIVE") {
    return peopleResponse(
      { error: "Only active guest accounts can be unlocked" },
      { status: 409 },
    );
  }

  if (!user.lockedUntil || user.lockedUntil <= new Date()) {
    return peopleResponse(
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

  const updatedUser = await database.user.update({
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
    actorUserId: actor.id,
    action: "ACCOUNT_UNLOCKED",
    entityType: "User",
    entityId: user.id,
    summary: `${user.firstName} ${user.lastName}'s guest account was unlocked`,
    metadata: {
      guestName: `${user.firstName} ${user.lastName}`,
      guestEmail: user.email,
      previousLockedUntil: user.lockedUntil.toISOString(),
    },
  }, database);

  return peopleResponse({
    message: "Guest account unlocked successfully",
    guest: {
      id: updatedUser.id,
      failedLoginAttempts: updatedUser.failedLoginAttempts,
      lockedUntil: updatedUser.lockedUntil?.toISOString() ?? null,
    },
  });
}
