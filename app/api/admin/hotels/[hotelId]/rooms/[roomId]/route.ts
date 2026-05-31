import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/hotelInventory";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import {
  validateManualRoomStatusChange,
  validateProtectedRoomFieldChange,
} from "@/lib/roomLifecycle";
import { roomUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type HotelAccessResult = Awaited<ReturnType<typeof requireHotelAccess>>;
type AuthorizedHotelAccess = Extract<HotelAccessResult, { ok: true }>;
type AuthorizedUser = AuthorizedHotelAccess["user"];

function canManageRooms(user: AuthorizedUser, hotelId: string) {
  return (
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER")
  );
}

function getRoomSelect() {
  return {
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
  } satisfies Prisma.RoomSelect;
}

async function getRoomById(hotelId: string, roomId: string) {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      hotelId,
      deletedAt: null,
    },
    select: getRoomSelect(),
  });
}

async function getActiveReservationAssignmentForRoom(
  hotelId: string,
  roomId: string,
) {
  return prisma.reservationRoom.findFirst({
    where: {
      roomId,
      reservation: {
        hotelId,
        status: {
          in: [...BLOCKING_RESERVATION_STATUSES],
        },
      },
    },
    select: {
      id: true,
      reservation: {
        select: {
          id: true,
          reservationNumber: true,
          status: true,
        },
      },
    },
  });
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; roomId: string }>;
  },
) {
  const { hotelId, roomId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const room = await getRoomById(hotelId, roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room });
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; roomId: string }>;
  },
) {
  const { hotelId, roomId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  if (!canManageRooms(auth.user, hotelId)) {
    return NextResponse.json(
      { error: "Requires HOTEL_ADMIN or MANAGER role for this hotel" },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = roomUpdateSchema.safeParse(body);

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

  const existingRoom = await prisma.room.findFirst({
    where: {
      id: roomId,
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      roomNumber: true,
      roomTypeId: true,
      status: true,
    },
  });

  if (!existingRoom) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const activeReservationAssignment =
    await getActiveReservationAssignmentForRoom(hotelId, roomId);

  const isChangingProtectedRoomFields =
    (input.roomTypeId !== undefined &&
      input.roomTypeId !== existingRoom.roomTypeId) ||
    (input.roomNumber !== undefined &&
      input.roomNumber !== existingRoom.roomNumber);

  if (isChangingProtectedRoomFields) {
    const protectedFieldValidation = validateProtectedRoomFieldChange({
      currentStatus: existingRoom.status,
      activeAssignment: activeReservationAssignment,
    });

    if (!protectedFieldValidation.ok) {
      return NextResponse.json(protectedFieldValidation.body, {
        status: protectedFieldValidation.status,
      });
    }
  }

  if (input.status !== undefined) {
    const statusValidation = validateManualRoomStatusChange({
      currentStatus: existingRoom.status,
      nextStatus: input.status,
      activeAssignment: activeReservationAssignment,
    });

    if (!statusValidation.ok) {
      return NextResponse.json(statusValidation.body, {
        status: statusValidation.status,
      });
    }
  }

  if (input.roomTypeId !== undefined) {
    const roomType = await prisma.roomType.findFirst({
      where: {
        id: input.roomTypeId,
        hotelId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { error: "Room type not found for this hotel" },
        { status: 400 },
      );
    }
  }

  if (input.roomNumber !== undefined) {
    const duplicateRoomNumber = await prisma.room.findFirst({
      where: {
        hotelId,
        roomNumber: input.roomNumber,
        id: {
          not: roomId,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateRoomNumber) {
      return NextResponse.json(
        { error: "A room with this room number already exists for this hotel" },
        { status: 409 },
      );
    }
  }

  try {
    const room = await prisma.room.update({
      where: {
        id: roomId,
      },
      data: {
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor,
        status: input.status,
        notes: input.notes,
      },
      select: getRoomSelect(),
    });

    return NextResponse.json({
      message: "Room updated successfully",
      room,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A unique constraint was violated while updating the room" },
        { status: 409 },
      );
    }

    console.error("Update room error:", error);

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
    params: Promise<{ hotelId: string; roomId: string }>;
  },
) {
  const { hotelId, roomId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  if (!canManageRooms(auth.user, hotelId)) {
    return NextResponse.json(
      { error: "Requires HOTEL_ADMIN or MANAGER role for this hotel" },
      { status: 403 },
    );
  }

  const existingRoom = await prisma.room.findFirst({
    where: {
      id: roomId,
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      roomNumber: true,
      status: true,
    },
  });

  if (!existingRoom) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (existingRoom.status !== "AVAILABLE") {
    return NextResponse.json(
      {
        error: "Only AVAILABLE rooms can be deleted",
        roomId: existingRoom.id,
        roomNumber: existingRoom.roomNumber,
        roomStatus: existingRoom.status,
      },
      { status: 409 },
    );
  }

  const activeReservationAssignment =
    await getActiveReservationAssignmentForRoom(hotelId, roomId);

  if (activeReservationAssignment) {
    return NextResponse.json(
      {
        error: "Cannot delete a room assigned to an active reservation",
        roomId: existingRoom.id,
        roomNumber: existingRoom.roomNumber,
        reservationId: activeReservationAssignment.reservation.id,
        reservationNumber:
          activeReservationAssignment.reservation.reservationNumber,
        reservationStatus: activeReservationAssignment.reservation.status,
      },
      { status: 409 },
    );
  }

  const reservationHistoryAssignment = await prisma.reservationRoom.findFirst({
    where: {
      roomId,
      reservation: {
        hotelId,
      },
    },
    select: {
      id: true,
      reservation: {
        select: {
          id: true,
          reservationNumber: true,
          status: true,
        },
      },
    },
  });

  if (reservationHistoryAssignment) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a room that has reservation history. Mark it OUT_OF_SERVICE or MAINTENANCE instead",
        roomId: existingRoom.id,
        roomNumber: existingRoom.roomNumber,
        reservationId: reservationHistoryAssignment.reservation.id,
        reservationNumber:
          reservationHistoryAssignment.reservation.reservationNumber,
        reservationStatus: reservationHistoryAssignment.reservation.status,
      },
      { status: 409 },
    );
  }

  try {
    const room = await prisma.room.update({
      where: {
        id: roomId,
      },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
        roomNumber: true,
        deletedAt: true,
      },
    });

    return NextResponse.json({
      message: "Room deleted successfully",
      room,
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}