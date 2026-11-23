import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createAuditLog } from "../common/audit-log";
import { hasGlobalRole, type AuthUser } from "../common/permissions";
import { getHotelById, getStaffAssignments, mapSingleStaff, mapStaff, getHotelAdminDenial, peopleResponse, type PeopleResult } from "./people-reads";
import { hotelStaffCreateSchema, hotelStaffUpdateSchema } from "./staff-write-schemas";

const HOTEL_STAFF_ROLE_NAMES = [
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
] as const;

function hasOnlyHotelStaffRoles(roleNames: string[]) {
  return roleNames.every((roleName) =>
    HOTEL_STAFF_ROLE_NAMES.includes(
      roleName as (typeof HOTEL_STAFF_ROLE_NAMES)[number],
    ),
  );
}

async function getHotelAdminRoleId(database: PrismaClient) {
  const role = await database.role.findUnique({
    where: {
      name: "HOTEL_ADMIN",
    },
    select: {
      id: true,
    },
  });

  if (!role) {
    throw new Error("HOTEL_ADMIN role is missing");
  }

  return role.id;
}

function hasRoleId(assignments: Array<{ roleId: string }>, roleId: string) {
  return assignments.some((assignment) => assignment.roleId === roleId);
}

async function countOtherActiveHotelAdmins(
  database: PrismaClient,
  hotelId: string,
  excludedUserId: string,
  hotelAdminRoleId: string,
) {
  return database.userHotelRole.count({
    where: {
      hotelId,
      roleId: hotelAdminRoleId,
      userId: {
        not: excludedUserId,
      },
      User: {
        deletedAt: null,
        status: "ACTIVE",
      },
    },
  });
}

function sameRoleIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);

  return left.every((item) => rightSet.has(item));
}

export async function createAdminStaff(
  database: PrismaClient,
  actor: AuthUser | null,
  hotelId: string,
  readBody: () => Promise<unknown>,
): Promise<PeopleResult> {
  const denied = getHotelAdminDenial(actor, hotelId);
  if (denied) return denied;
  if (!actor) return peopleResponse({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return peopleResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hotelStaffCreateSchema.safeParse(body);

  if (!parsed.success) {
    return peopleResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { roleNames } = parsed.data;

  if (!hasOnlyHotelStaffRoles(roleNames)) {
    return peopleResponse(
      {
        error:
          "Hotel staff roles must be HOTEL_ADMIN, MANAGER, or RECEPTIONIST",
      },
      { status: 400 },
    );
  }

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return peopleResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const roles = await database.role.findMany({
    where: {
      name: {
        in: roleNames,
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (roles.length !== roleNames.length) {
    const foundRoleNames = new Set(roles.map((role) => role.name));
    const missingRoleNames = roleNames.filter(
      (name) => !foundRoleNames.has(name),
    );

    return peopleResponse(
      {
        error: "One or more roleNames are invalid",
        missingRoleNames,
      },
      { status: 400 },
    );
  }

  try {
    let userId: string;

    if (parsed.data.userId) {
      const user = await database.user.findFirst({
        where: {
          id: parsed.data.userId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!user) {
        return peopleResponse({ error: "User not found" }, { status: 404 });
      }

      if (user.status !== "ACTIVE") {
        return peopleResponse(
          {
            error: "Only ACTIVE users can be assigned as hotel staff",
            userId: user.id,
            userStatus: user.status,
          },
          { status: 409 },
        );
      }

      const existingHotelAssignments = await database.userHotelRole.findMany({
        where: {
          hotelId,
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (existingHotelAssignments.length > 0) {
        return peopleResponse(
          {
            error:
              "This user is already assigned to this hotel. Use PATCH to replace their hotel roles",
          },
          { status: 409 },
        );
      }

      userId = user.id;

      await database.userHotelRole.createMany({
        data: roles.map((role) => ({
          id: randomUUID(),
          userId,
          hotelId,
          roleId: role.id,
        })),
      });
    } else {
      const firstName = parsed.data.firstName;
      const lastName = parsed.data.lastName;
      const email = parsed.data.email;
      const phone = parsed.data.phone;
      const password = parsed.data.password;

      if (!firstName || !lastName || !email || !password) {
        return peopleResponse(
          { error: "Missing new staff user fields" },
          { status: 400 },
        );
      }

      const existingUserWithEmail = await database.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (existingUserWithEmail) {
        return peopleResponse(
          {
            error:
              "A user with this email already exists. Assign the existing user instead or use another email.",
          },
          { status: 409 },
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const createdUser = await database.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            firstName,
            lastName,
            email,
            phone,
            passwordHash,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        });

        await tx.userHotelRole.createMany({
          data: roles.map((role) => ({
            id: randomUUID(),
            userId: user.id,
            hotelId,
            roleId: role.id,
          })),
        });

        return user;
      });

      userId = createdUser.id;
    }

    const assignments = await getStaffAssignments(database, hotelId, userId);
    const [staffMember] = mapStaff(assignments);

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "STAFF_ASSIGNED",
      entityType: "User",
      entityId: staffMember.id,
      summary: `${staffMember.firstName} ${staffMember.lastName} was assigned as hotel staff`,
      metadata: {
        staffName: `${staffMember.firstName} ${staffMember.lastName}`,
        staffEmail: staffMember.email,
        roles: staffMember.roles.map((role) => role.name),
      },
    }, database);

    return peopleResponse(
      {
        message: "Staff member assigned successfully",
        staff: staffMember,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return peopleResponse(
        {
          error: "A duplicate user or staff assignment already exists",
        },
        { status: 409 },
      );
    }

    console.error("Create hotel staff error:", error);

    return peopleResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function updateAdminStaff(
  database: PrismaClient,
  actor: AuthUser | null,
  hotelId: string,
  staffId: string,
  readBody: () => Promise<unknown>,
): Promise<PeopleResult> {
  const denied = getHotelAdminDenial(actor, hotelId);
  if (denied) return denied;
  if (!actor) return peopleResponse({ error: "Unauthorized" }, { status: 401 });

  if (actor.id === staffId && !hasGlobalRole(actor, "SUPER_ADMIN")) {
    return peopleResponse(
      {
        error:
          "You cannot update your own hotel staff roles. Another HOTEL_ADMIN or SUPER_ADMIN must do this",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return peopleResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hotelStaffUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return peopleResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { roleNames } = parsed.data;

  if (!hasOnlyHotelStaffRoles(roleNames)) {
    return peopleResponse(
      {
        error:
          "Hotel staff roles must be HOTEL_ADMIN, MANAGER, or RECEPTIONIST",
      },
      { status: 400 },
    );
  }

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return peopleResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const currentAssignments = await getStaffAssignments(database, hotelId, staffId);

  if (currentAssignments.length === 0) {
    return peopleResponse(
      { error: "Staff member not found for this hotel" },
      { status: 404 },
    );
  }

  const targetUser = currentAssignments[0].User;

  if (targetUser.status !== "ACTIVE") {
    return peopleResponse(
      {
        error:
          "Cannot update hotel staff roles for an inactive or suspended user",
        userId: targetUser.id,
        userStatus: targetUser.status,
      },
      { status: 409 },
    );
  }

  const roles = await database.role.findMany({
    where: {
      name: {
        in: roleNames,
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (roles.length !== roleNames.length) {
    const foundRoleNames = new Set(roles.map((role) => role.name));
    const missingRoleNames = roleNames.filter(
      (name) => !foundRoleNames.has(name),
    );

    return peopleResponse(
      {
        error: "One or more roleNames are invalid",
        missingRoleNames,
      },
      { status: 400 },
    );
  }

  const currentRoleIds = currentAssignments.map((assignment) => assignment.roleId);
  const nextRoleIds = roles.map((role) => role.id);

  if (sameRoleIdSet(currentRoleIds, nextRoleIds)) {
    const staff = mapSingleStaff(currentAssignments);

    return peopleResponse({
      message: "Staff member already has these hotel roles",
      staff,
    });
  }

  const hotelAdminRoleId = await getHotelAdminRoleId(database);

  const targetCurrentlyHotelAdmin = hasRoleId(
    currentAssignments,
    hotelAdminRoleId,
  );

  const targetWillRemainHotelAdmin = roles.some(
    (role) => role.id === hotelAdminRoleId,
  );

  if (targetCurrentlyHotelAdmin && !targetWillRemainHotelAdmin) {
    const otherActiveHotelAdmins = await countOtherActiveHotelAdmins(
      database,
      hotelId,
      staffId,
      hotelAdminRoleId,
    );

    if (otherActiveHotelAdmins === 0) {
      return peopleResponse(
        {
          error: "Cannot remove the last HOTEL_ADMIN from this hotel",
          hotelId,
          staffId,
        },
        { status: 409 },
      );
    }
  }

  try {
    await database.$transaction(async (tx) => {
      const freshAssignments = await tx.userHotelRole.findMany({
        where: {
          hotelId,
          userId: staffId,
          User: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
          roleId: true,
        },
      });

      if (freshAssignments.length === 0) {
        throw new Error("STAFF_ASSIGNMENTS_NOT_FOUND");
      }

      const freshTargetCurrentlyHotelAdmin = hasRoleId(
        freshAssignments,
        hotelAdminRoleId,
      );

      if (freshTargetCurrentlyHotelAdmin && !targetWillRemainHotelAdmin) {
        const otherActiveHotelAdmins = await tx.userHotelRole.count({
          where: {
            hotelId,
            roleId: hotelAdminRoleId,
            userId: {
              not: staffId,
            },
            User: {
              deletedAt: null,
              status: "ACTIVE",
            },
          },
        });

        if (otherActiveHotelAdmins === 0) {
          throw new Error("LAST_HOTEL_ADMIN");
        }
      }

      await tx.userHotelRole.deleteMany({
        where: {
          hotelId,
          userId: staffId,
        },
      });

      await tx.userHotelRole.createMany({
        data: roles.map((role) => ({
          id: randomUUID(),
          userId: staffId,
          hotelId,
          roleId: role.id,
        })),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const assignments = await getStaffAssignments(database, hotelId, staffId);
    const staff = mapSingleStaff(assignments);

    if (!staff) {
      return peopleResponse(
        { error: "Updated staff member could not be loaded" },
        { status: 500 },
      );
    }

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "STAFF_ROLES_UPDATED",
      entityType: "User",
      entityId: staff.id,
      summary: `${staff.firstName} ${staff.lastName}'s hotel roles were updated`,
      metadata: {
        staffName: `${staff.firstName} ${staff.lastName}`,
        staffEmail: staff.email,
        previousRoles: currentAssignments.map(
          (assignment) => assignment.Role.name,
        ),
        nextRoles: staff.roles.map((role) => role.name),
      },
    }, database);

    return peopleResponse({
      message: "Staff member updated successfully",
      staff,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return peopleResponse(
        { error: "Staff roles changed during the request. Refresh the staff list and try again." },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "LAST_HOTEL_ADMIN") {
      return peopleResponse(
        {
          error: "Cannot remove the last HOTEL_ADMIN from this hotel",
          hotelId,
          staffId,
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "STAFF_ASSIGNMENTS_NOT_FOUND"
    ) {
      return peopleResponse(
        { error: "Staff member not found for this hotel" },
        { status: 404 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return peopleResponse(
        {
          error: "Duplicate hotel staff role assignment detected",
        },
        { status: 409 },
      );
    }

    console.error("Update hotel staff error:", error);

    return peopleResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function removeAdminStaff(
  database: PrismaClient,
  actor: AuthUser | null,
  hotelId: string,
  staffId: string,
): Promise<PeopleResult> {
  const denied = getHotelAdminDenial(actor, hotelId);
  if (denied) return denied;
  if (!actor) return peopleResponse({ error: "Unauthorized" }, { status: 401 });

  if (actor.id === staffId && !hasGlobalRole(actor, "SUPER_ADMIN")) {
    return peopleResponse(
      {
        error:
          "You cannot remove yourself from hotel staff. Another HOTEL_ADMIN or SUPER_ADMIN must do this",
      },
      { status: 409 },
    );
  }

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return peopleResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const existingAssignments = await getStaffAssignments(database, hotelId, staffId);

  if (existingAssignments.length === 0) {
    return peopleResponse(
      { error: "Staff member not found for this hotel" },
      { status: 404 },
    );
  }

  const hotelAdminRoleId = await getHotelAdminRoleId(database);

  const targetCurrentlyHotelAdmin = hasRoleId(
    existingAssignments,
    hotelAdminRoleId,
  );

  if (targetCurrentlyHotelAdmin) {
    const otherActiveHotelAdmins = await countOtherActiveHotelAdmins(
      database,
      hotelId,
      staffId,
      hotelAdminRoleId,
    );

    if (otherActiveHotelAdmins === 0) {
      return peopleResponse(
        {
          error: "Cannot remove the last HOTEL_ADMIN from this hotel",
          hotelId,
          staffId,
        },
        { status: 409 },
      );
    }
  }

  try {
    await database.$transaction(async (tx) => {
      const freshAssignments = await tx.userHotelRole.findMany({
        where: {
          hotelId,
          userId: staffId,
          User: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
          roleId: true,
        },
      });

      if (freshAssignments.length === 0) {
        throw new Error("STAFF_ASSIGNMENTS_NOT_FOUND");
      }

      const freshTargetCurrentlyHotelAdmin = hasRoleId(
        freshAssignments,
        hotelAdminRoleId,
      );

      if (freshTargetCurrentlyHotelAdmin) {
        const otherActiveHotelAdmins = await tx.userHotelRole.count({
          where: {
            hotelId,
            roleId: hotelAdminRoleId,
            userId: {
              not: staffId,
            },
            User: {
              deletedAt: null,
              status: "ACTIVE",
            },
          },
        });

        if (otherActiveHotelAdmins === 0) {
          throw new Error("LAST_HOTEL_ADMIN");
        }
      }

      await tx.userHotelRole.deleteMany({
        where: {
          hotelId,
          userId: staffId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const staffUser = existingAssignments[0].User;

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "STAFF_REMOVED",
      entityType: "User",
      entityId: staffUser.id,
      summary: `${staffUser.firstName} ${staffUser.lastName} was removed from hotel staff`,
      metadata: {
        staffName: `${staffUser.firstName} ${staffUser.lastName}`,
        staffEmail: staffUser.email,
        previousRoles: existingAssignments.map(
          (assignment) => assignment.Role.name,
        ),
      },
    }, database);

    return peopleResponse({
      message: "Staff member removed from this hotel successfully",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return peopleResponse(
        { error: "Staff roles changed during the request. Refresh the staff list and try again." },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "LAST_HOTEL_ADMIN") {
      return peopleResponse(
        {
          error: "Cannot remove the last HOTEL_ADMIN from this hotel",
          hotelId,
          staffId,
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "STAFF_ASSIGNMENTS_NOT_FOUND"
    ) {
      return peopleResponse(
        { error: "Staff member not found for this hotel" },
        { status: 404 },
      );
    }

    console.error("Delete hotel staff error:", error);

    return peopleResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
