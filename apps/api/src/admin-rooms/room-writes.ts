import { Prisma, type PrismaClient } from "@prisma/client";
import { createAuditLog } from "../common/audit-log";
import type { AuthUser } from "../common/permissions";
import { BLOCKING_RESERVATION_STATUSES } from "../booking-domain/hotel-inventory";
import { getRoomSelect } from "./room-reads";
import { roomCreateSchema, roomUpdateSchema } from "./room-schemas";
import { getInventoryWriteAccess, inventoryResponse } from "./room-write-access";
import { validateManualRoomStatusChange, validateProtectedRoomFieldChange, validateRoomCreateStatus } from "./room-lifecycle";

async function getActiveReservationAssignmentForRoom(
  database: PrismaClient,
  hotelId: string,
  roomId: string,
) {
  return database.reservationRoom.findFirst({
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

export async function createRoom(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  readBody: () => Promise<unknown>,
) {
  const access = getInventoryWriteAccess(user, hotelId);
  if (!access.ok) return access.result;
  const actor = access.user;

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return inventoryResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = roomCreateSchema.safeParse(body);

  if (!parsed.success) {
    return inventoryResponse(
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
    return inventoryResponse(statusValidation.body, {
      status: statusValidation.status,
    });
  }

  const hotel = await database.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!hotel) {
    return inventoryResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const roomType = await database.roomType.findFirst({
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
    return inventoryResponse(
      {
        error: "Room type not found for this hotel",
      },
      { status: 400 },
    );
  }

  const existingRoom = await database.room.findFirst({
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
    return inventoryResponse(
      {
        error: "A room with this room number already exists for this hotel",
      },
      { status: 409 },
    );
  }

  try {
    const room = await database.room.create({
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

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "ROOM_CREATED",
      entityType: "Room",
      entityId: room.id,
      summary: `Room ${room.roomNumber} was created`,
      metadata: {
        roomNumber: room.roomNumber,
        roomType: room.roomType.name,
        floor: room.floor,
        status: room.status,
      },
    }, database);

    return inventoryResponse(
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
      return inventoryResponse(
        {
          error: "A unique constraint was violated while creating the room",
        },
        { status: 409 },
      );
    }

    console.error("Create room error:", error);

    return inventoryResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function updateRoom(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  roomId: string,
  readBody: () => Promise<unknown>,
) {
  const access = getInventoryWriteAccess(user, hotelId);
  if (!access.ok) return access.result;
  const actor = access.user;

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return inventoryResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = roomUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return inventoryResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const existingRoom = await database.room.findFirst({
    where: {
      id: roomId,
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      roomNumber: true,
      roomTypeId: true,
      floor: true,
      status: true,
      notes: true,
    },
  });

  if (!existingRoom) {
    return inventoryResponse({ error: "Room not found" }, { status: 404 });
  }

  const activeReservationAssignment =
    await getActiveReservationAssignmentForRoom(database, hotelId, roomId);

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
      return inventoryResponse(protectedFieldValidation.body, {
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
      return inventoryResponse(statusValidation.body, {
        status: statusValidation.status,
      });
    }
  }

  if (input.roomTypeId !== undefined) {
    const roomType = await database.roomType.findFirst({
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
      return inventoryResponse(
        { error: "Room type not found for this hotel" },
        { status: 400 },
      );
    }
  }

  if (input.roomNumber !== undefined) {
    const duplicateRoomNumber = await database.room.findFirst({
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
      return inventoryResponse(
        { error: "A room with this room number already exists for this hotel" },
        { status: 409 },
      );
    }
  }

  try {
    const room = await database.room.update({
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

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "ROOM_UPDATED",
      entityType: "Room",
      entityId: room.id,
      summary: `Room ${room.roomNumber} was updated`,
      metadata: {
        roomNumber: room.roomNumber,
        previousRoomNumber: existingRoom.roomNumber,
        nextRoomNumber: room.roomNumber,
        previousRoomTypeId: existingRoom.roomTypeId,
        nextRoomTypeId: room.roomTypeId,
        previousFloor: existingRoom.floor,
        nextFloor: room.floor,
        previousStatus: existingRoom.status,
        nextStatus: room.status,
        notesChanged: existingRoom.notes !== room.notes,
      },
    }, database);

    return inventoryResponse({
      message: "Room updated successfully",
      room,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return inventoryResponse(
        { error: "A unique constraint was violated while updating the room" },
        { status: 409 },
      );
    }

    console.error("Update room error:", error);

    return inventoryResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function deleteRoom(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  roomId: string,
) {
  const access = getInventoryWriteAccess(user, hotelId);
  if (!access.ok) return access.result;
  const actor = access.user;

  const existingRoom = await database.room.findFirst({
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
    return inventoryResponse({ error: "Room not found" }, { status: 404 });
  }

  if (existingRoom.status !== "AVAILABLE") {
    return inventoryResponse(
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
    await getActiveReservationAssignmentForRoom(database, hotelId, roomId);

  if (activeReservationAssignment) {
    return inventoryResponse(
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

  const reservationHistoryAssignment = await database.reservationRoom.findFirst({
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
    return inventoryResponse(
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
    const room = await database.room.update({
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

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "ROOM_DELETED",
      entityType: "Room",
      entityId: room.id,
      summary: `Room ${room.roomNumber} was deleted`,
      metadata: {
        roomNumber: room.roomNumber,
        deletedAt: room.deletedAt,
      },
    }, database);

    return inventoryResponse({
      message: "Room deleted successfully",
      room,
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return inventoryResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
