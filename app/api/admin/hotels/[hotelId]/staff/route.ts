import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelRole } from "@/lib/guards";
import { hotelStaffCreateSchema } from "@/lib/validators";

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

async function getStaffAssignments(hotelId: string, userId?: string) {
  return prisma.userHotelRole.findMany({
    where: {
      hotelId,
      ...(userId ? { userId } : {}),
      User: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
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

function mapStaff(assignments: Awaited<ReturnType<typeof getStaffAssignments>>) {
  const staffMap = new Map<
    string,
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      status: string;
      createdAt: Date;
      assignedAt: Date;
      roles: Array<{
        id: string;
        name: string;
        description: string | null;
      }>;
    }
  >();

  for (const assignment of assignments) {
    const existing = staffMap.get(assignment.User.id);

    if (!existing) {
      staffMap.set(assignment.User.id, {
        id: assignment.User.id,
        firstName: assignment.User.firstName,
        lastName: assignment.User.lastName,
        email: assignment.User.email,
        phone: assignment.User.phone,
        status: assignment.User.status,
        createdAt: assignment.User.createdAt,
        assignedAt: assignment.createdAt,
        roles: [
          {
            id: assignment.Role.id,
            name: assignment.Role.name,
            description: assignment.Role.description,
          },
        ],
      });

      continue;
    }

    existing.roles.push({
      id: assignment.Role.id,
      name: assignment.Role.name,
      description: assignment.Role.description,
    });
  }

  return Array.from(staffMap.values()).sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();

    return nameA.localeCompare(nameB);
  });
}

function hasOnlyHotelStaffRoles(roleNames: string[]) {
  return roleNames.every((roleName) =>
    HOTEL_STAFF_ROLE_NAMES.includes(
      roleName as (typeof HOTEL_STAFF_ROLE_NAMES)[number],
    ),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelRole(hotelId, "HOTEL_ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const hotel = await getHotelById(hotelId);

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const assignments = await getStaffAssignments(hotelId);

  return NextResponse.json({
    hotelId: hotel.id,
    hotelName: hotel.name,
    staff: mapStaff(assignments),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelRole(hotelId, "HOTEL_ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hotelStaffCreateSchema.safeParse(body);

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

  try {
    let userId: string;

    if (parsed.data.userId) {
      const user = await prisma.user.findFirst({
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
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (user.status !== "ACTIVE") {
        return NextResponse.json(
          {
            error: "Only ACTIVE users can be assigned as hotel staff",
            userId: user.id,
            userStatus: user.status,
          },
          { status: 409 },
        );
      }

      const existingHotelAssignments = await prisma.userHotelRole.findMany({
        where: {
          hotelId,
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (existingHotelAssignments.length > 0) {
        return NextResponse.json(
          {
            error:
              "This user is already assigned to this hotel. Use PATCH to replace their hotel roles",
          },
          { status: 409 },
        );
      }

      userId = user.id;

      await prisma.userHotelRole.createMany({
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
        return NextResponse.json(
          { error: "Missing new staff user fields" },
          { status: 400 },
        );
      }

      const existingUserWithEmail = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (existingUserWithEmail) {
        return NextResponse.json(
          {
            error:
              "A user with this email already exists. Assign the existing user instead or use another email.",
          },
          { status: 409 },
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const createdUser = await prisma.$transaction(async (tx) => {
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

    const assignments = await getStaffAssignments(hotelId, userId);
    const [staffMember] = mapStaff(assignments);

    return NextResponse.json(
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
      return NextResponse.json(
        {
          error: "A duplicate user or staff assignment already exists",
        },
        { status: 409 },
      );
    }

    console.error("Create hotel staff error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}