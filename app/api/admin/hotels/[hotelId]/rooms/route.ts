import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import { validateRoomCreateStatus } from "@/lib/roomLifecycle";
import { roomCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      hotelId: true,
      roomTypeId: true,
      roomNumber: true,
      floor: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      roomType: {
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          capacityAdults: true,
          capacityChildren: true,
          bedType: true,
        },
      },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });

  return NextResponse.json({
    hotelId,
    rooms,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const user = auth.user;

  const canManageRooms =
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER");

  if (!canManageRooms) {
    return NextResponse.json(
      {
        error: "Requires HOTEL_ADMIN or MANAGER role for this hotel",
      },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = roomCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const statusValidation = validateRoomCreateStatus(input.status);

  if (!statusValidation.ok) {
    return NextResponse.json(statusValidation.body, {
      status: statusValidation.status,
    });
  }

  const hotel = await prisma.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const roomType = await prisma.roomType.findFirst({
    where: {
      id: input.roomTypeId,
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!roomType) {
    return NextResponse.json(
      {
        error: "Room type not found for this hotel",
      },
      { status: 400 },
    );
  }

  const existingRoom = await prisma.room.findFirst({
    where: {
      hotelId,
      roomNumber: input.roomNumber,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (existingRoom) {
    return NextResponse.json(
      {
        error: "A room with this room number already exists for this hotel",
      },
      { status: 409 },
    );
  }

  try {
    const room = await prisma.room.create({
      data: {
        hotelId,
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor,
        status: input.status,
        notes: input.notes,
      },
      select: {
        id: true,
        hotelId: true,
        roomTypeId: true,
        roomNumber: true,
        floor: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        roomType: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            capacityAdults: true,
            capacityChildren: true,
            bedType: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Room created successfully",
        room,
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
          error: "A unique constraint was violated while creating the room",
        },
        { status: 409 },
      );
    }

    console.error("Create room error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}