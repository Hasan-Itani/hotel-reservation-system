import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { requireHotelRole } from "@/lib/guards";
import { hasGlobalRole } from "@/lib/permissions";
import { hotelStaffUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const HOTEL_STAFF_ROLE_NAMES = [
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
] as const;

async function getHotelById(hotelId: string) {
  return prisma.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

async function getStaffAssignments(hotelId: string, userId: string) {
  return prisma.userHotelRole.findMany({
    where: {
      hotelId,
      userId,
      User: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      roleId: true,
      createdAt: true,
      Role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function getHotelAdminRoleId() {
  const role = await prisma.role.findUnique({
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
  hotelId: string,
  excludedUserId: string,
  hotelAdminRoleId: string,
) {
  return prisma.userHotelRole.count({
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

function mapSingleStaff(
  assignments: Awaited<ReturnType<typeof getStaffAssignments>>,
) {
  if (assignments.length === 0) {
    return null;
  }

  const first = assignments[0];

  return {
    id: first.User.id,
    firstName: first.User.firstName,
    lastName: first.User.lastName,
    email: first.User.email,
    phone: first.User.phone,
    status: first.User.status,
    createdAt: first.User.createdAt,
    assignedAt: first.createdAt,
    roles: assignments.map((assignment) => ({
      id: assignment.Role.id,
      name: assignment.Role.name,
      description: assignment.Role.description,
    })),
  };
}

function hasOnlyHotelStaffRoles(roleNames: string[]) {
  return roleNames.every((roleName) =>
    HOTEL_STAFF_ROLE_NAMES.includes(
      roleName as (typeof HOTEL_STAFF_ROLE_NAMES)[number],
    ),
  );
}

function sameRoleIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);

  return left.every((item) => rightSet.has(item));
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; staffId: string }>;
  },
) {
  const { hotelId, staffId } = await params;

  const auth = await requireHotelRole(hotelId, "HOTEL_ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const hotel = await getHotelById(hotelId);

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const assignments = await getStaffAssignments(hotelId, staffId);
  const staff = mapSingleStaff(assignments);

  if (!staff) {
    return NextResponse.json(
      { error: "Staff member not found for this hotel" },
      { status: 404 },
    );
  }

  return NextResponse.json({ staff });
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; staffId: string }>;
  },
) {
  const { hotelId, staffId } = await params;

  const auth = await requireHotelRole(hotelId, "HOTEL_ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.user.id === staffId && !hasGlobalRole(auth.user, "SUPER_ADMIN")) {
    return NextResponse.json(
      {
        error:
          "You cannot update your own hotel staff roles. Another HOTEL_ADMIN or SUPER_ADMIN must do this",
      },
      { status: 409 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hotelStaffUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { roleNames } = parsed.data;

  if (!hasOnlyHotelStaffRoles(roleNames)) {
    return NextResponse.json(
      {
        error:
          "Hotel staff roles must be HOTEL_ADMIN, MANAGER, or RECEPTIONIST",
      },
      { status: 400 },
    );
  }

  const hotel = await getHotelById(hotelId);

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const currentAssignments = await getStaffAssignments(hotelId, staffId);

  if (currentAssignments.length === 0) {
    return NextResponse.json(
      { error: "Staff member not found for this hotel" },
      { status: 404 },
    );
  }

  const targetUser = currentAssignments[0].User;

  if (targetUser.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error:
          "Cannot update hotel staff roles for an inactive or suspended user",
        userId: targetUser.id,
        userStatus: targetUser.status,
      },
      { status: 409 },
    );
  }

  const roles = await prisma.role.findMany({
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

    return NextResponse.json(
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

    return NextResponse.json({
      message: "Staff member already has these hotel roles",
      staff,
    });
  }

  const hotelAdminRoleId = await getHotelAdminRoleId();

  const targetCurrentlyHotelAdmin = hasRoleId(
    currentAssignments,
    hotelAdminRoleId,
  );

  const targetWillRemainHotelAdmin = roles.some(
    (role) => role.id === hotelAdminRoleId,
  );

  if (targetCurrentlyHotelAdmin && !targetWillRemainHotelAdmin) {
    const otherActiveHotelAdmins = await countOtherActiveHotelAdmins(
      hotelId,
      staffId,
      hotelAdminRoleId,
    );

    if (otherActiveHotelAdmins === 0) {
      return NextResponse.json(
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
    await prisma.$transaction(async (tx) => {
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
    });

    const assignments = await getStaffAssignments(hotelId, staffId);
    const staff = mapSingleStaff(assignments);

    if (!staff) {
      return NextResponse.json(
        { error: "Updated staff member could not be loaded" },
        { status: 500 },
      );
    }

    await createAuditLog({
      hotelId,
      actorUserId: auth.user.id,
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
    });

    return NextResponse.json({
      message: "Staff member updated successfully",
      staff,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_HOTEL_ADMIN") {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: "Staff member not found for this hotel" },
        { status: 404 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Duplicate hotel staff role assignment detected",
        },
        { status: 409 },
      );
    }

    console.error("Update hotel staff error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; staffId: string }>;
  },
) {
  const { hotelId, staffId } = await params;

  const auth = await requireHotelRole(hotelId, "HOTEL_ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.user.id === staffId && !hasGlobalRole(auth.user, "SUPER_ADMIN")) {
    return NextResponse.json(
      {
        error:
          "You cannot remove yourself from hotel staff. Another HOTEL_ADMIN or SUPER_ADMIN must do this",
      },
      { status: 409 },
    );
  }

  const hotel = await getHotelById(hotelId);

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const existingAssignments = await getStaffAssignments(hotelId, staffId);

  if (existingAssignments.length === 0) {
    return NextResponse.json(
      { error: "Staff member not found for this hotel" },
      { status: 404 },
    );
  }

  const hotelAdminRoleId = await getHotelAdminRoleId();

  const targetCurrentlyHotelAdmin = hasRoleId(
    existingAssignments,
    hotelAdminRoleId,
  );

  if (targetCurrentlyHotelAdmin) {
    const otherActiveHotelAdmins = await countOtherActiveHotelAdmins(
      hotelId,
      staffId,
      hotelAdminRoleId,
    );

    if (otherActiveHotelAdmins === 0) {
      return NextResponse.json(
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
    await prisma.$transaction(async (tx) => {
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
    });

    const staffUser = existingAssignments[0].User;

    await createAuditLog({
      hotelId,
      actorUserId: auth.user.id,
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
    });

    return NextResponse.json({
      message: "Staff member removed from this hotel successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_HOTEL_ADMIN") {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: "Staff member not found for this hotel" },
        { status: 404 },
      );
    }

    console.error("Delete hotel staff error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
