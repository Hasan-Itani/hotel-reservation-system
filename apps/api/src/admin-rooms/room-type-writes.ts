import { Prisma, type PrismaClient } from "@prisma/client";
import { createAuditLog } from "../common/audit-log";
import type { AuthUser } from "../common/permissions";
import { BLOCKING_RESERVATION_STATUSES } from "../booking-domain/hotel-inventory";
import { formatRoomTypeResponse, getRoomTypeSelect } from "./room-reads";
import { roomTypeCreateSchema, roomTypeUpdateSchema } from "./room-schemas";
import { getInventoryWriteAccess, inventoryResponse } from "./room-write-access";

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function decimalToNumber(value: Prisma.Decimal | null) {
  return value === null ? null : value.toNumber();
}

function nullableStringChanged(
  inputValue: string | null | undefined,
  existingValue: string | null,
) {
  if (inputValue === undefined) {
    return false;
  }

  return inputValue !== existingValue;
}

function decimalChanged(
  inputValue: number | undefined,
  existingValue: Prisma.Decimal,
) {
  if (inputValue === undefined) {
    return false;
  }

  return inputValue !== existingValue.toNumber();
}

function nullableDecimalChanged(
  inputValue: number | null | undefined,
  existingValue: Prisma.Decimal | null,
) {
  if (inputValue === undefined) {
    return false;
  }

  if (inputValue === null) {
    return existingValue !== null;
  }

  return inputValue !== decimalToNumber(existingValue);
}

async function getActiveReservationUsageForRoomType(
  database: PrismaClient,
  hotelId: string,
  roomTypeId: string,
) {
  return database.reservationRoom.findFirst({
    where: {
      roomTypeId,
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

async function getReservationHistoryUsageForRoomType(
  database: PrismaClient,
  hotelId: string,
  roomTypeId: string,
) {
  return database.reservationRoom.findFirst({
    where: {
      roomTypeId,
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
}

export async function createRoomType(
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

  const parsed = roomTypeCreateSchema.safeParse(body);

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
  const slug = input.slug ?? createSlug(input.name);

  if (!slug) {
    return inventoryResponse(
      { error: "Unable to generate a valid slug from the room type name" },
      { status: 400 },
    );
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

  const existingRoomType = await database.roomType.findFirst({
    where: {
      hotelId,
      slug,
    },
    select: {
      id: true,
    },
  });

  if (existingRoomType) {
    return inventoryResponse(
      { error: "A room type with this slug already exists for this hotel" },
      { status: 409 },
    );
  }

  if (input.amenityIds.length > 0) {
    const amenities = await database.amenity.findMany({
      where: {
        id: { in: input.amenityIds },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (amenities.length !== input.amenityIds.length) {
      return inventoryResponse(
        { error: "One or more amenityIds are invalid" },
        { status: 400 },
      );
    }
  }

  try {
    const roomType = await database.roomType.create({
      data: {
        hotelId,
        name: input.name,
        slug,
        description: input.description,
        basePrice: input.basePrice,
        capacityAdults: input.capacityAdults,
        capacityChildren: input.capacityChildren,
        bedType: input.bedType,
        roomSizeSqm: input.roomSizeSqm,
        amenities:
          input.amenityIds.length > 0
            ? {
                create: input.amenityIds.map((amenityId) => ({
                  amenityId,
                })),
              }
            : undefined,
        images:
          input.images.length > 0
            ? {
                create: input.images.map((image) => ({
                  url: image.url,
                  altText: image.altText,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary,
                })),
              }
            : undefined,
      },
      select: {
        id: true,
        hotelId: true,
        name: true,
        slug: true,
        description: true,
        basePrice: true,
        capacityAdults: true,
        capacityChildren: true,
        bedType: true,
        roomSizeSqm: true,
        createdAt: true,
        _count: {
          select: {
            rooms: true,
            reservationRooms: true,
          },
        },
        images: {
          select: {
            id: true,
            url: true,
            altText: true,
            sortOrder: true,
            isPrimary: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        amenities: {
          select: {
            amenity: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
    });

    await createAuditLog({
      hotelId,
      actorUserId: actor.id,
      action: "ROOM_TYPE_CREATED",
      entityType: "RoomType",
      entityId: roomType.id,
      summary: `Room type ${roomType.name} was created`,
      metadata: {
        name: roomType.name,
        slug: roomType.slug,
        basePrice: Number(roomType.basePrice),
        capacityAdults: roomType.capacityAdults,
        capacityChildren: roomType.capacityChildren,
        imageCount: roomType.images.length,
        amenityCount: roomType.amenities.length,
      },
    }, database);

    return inventoryResponse(
      {
        message: "Room type created successfully",
        roomType: {
          ...roomType,
          amenities: roomType.amenities.map((item) => item.amenity),
        },
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
          error:
            "A unique constraint was violated while creating the room type",
        },
        { status: 409 },
      );
    }

    console.error("Create room type error:", error);

    return inventoryResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function updateRoomType(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  roomTypeId: string,
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

  const parsed = roomTypeUpdateSchema.safeParse(body);

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

  const existingRoomType = await database.roomType.findFirst({
    where: {
      id: roomTypeId,
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      basePrice: true,
      capacityAdults: true,
      capacityChildren: true,
      bedType: true,
      roomSizeSqm: true,
    },
  });

  if (!existingRoomType) {
    return inventoryResponse({ error: "Room type not found" }, { status: 404 });
  }

  const isChangingProtectedRoomTypeFields =
    (input.name !== undefined && input.name !== existingRoomType.name) ||
    (input.slug !== undefined && input.slug !== existingRoomType.slug) ||
    decimalChanged(input.basePrice, existingRoomType.basePrice) ||
    (input.capacityAdults !== undefined &&
      input.capacityAdults !== existingRoomType.capacityAdults) ||
    (input.capacityChildren !== undefined &&
      input.capacityChildren !== existingRoomType.capacityChildren) ||
    nullableStringChanged(input.bedType, existingRoomType.bedType) ||
    nullableDecimalChanged(input.roomSizeSqm, existingRoomType.roomSizeSqm) ||
    input.amenityIds !== undefined;

  if (isChangingProtectedRoomTypeFields) {
    const activeReservationUsage = await getActiveReservationUsageForRoomType(
      database,
      hotelId,
      roomTypeId,
    );

    if (activeReservationUsage) {
      return inventoryResponse(
        {
          error:
            "Cannot change core room type details while the room type is used by an active reservation",
          roomTypeId: existingRoomType.id,
          roomTypeName: existingRoomType.name,
          reservationId: activeReservationUsage.reservation.id,
          reservationNumber:
            activeReservationUsage.reservation.reservationNumber,
          reservationStatus: activeReservationUsage.reservation.status,
        },
        { status: 409 },
      );
    }
  }

  if (input.slug !== undefined) {
    const duplicateSlug = await database.roomType.findFirst({
      where: {
        hotelId,
        slug: input.slug,
        id: {
          not: roomTypeId,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateSlug) {
      return inventoryResponse(
        { error: "A room type with this slug already exists for this hotel" },
        { status: 409 },
      );
    }
  }

  if (input.amenityIds !== undefined && input.amenityIds.length > 0) {
    const amenities = await database.amenity.findMany({
      where: {
        id: {
          in: input.amenityIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (amenities.length !== input.amenityIds.length) {
      return inventoryResponse(
        { error: "One or more amenityIds are invalid" },
        { status: 400 },
      );
    }
  }

  try {
    const roomType = await database.$transaction(async (tx) => {
      if (isChangingProtectedRoomTypeFields) {
        const activeReservationUsage = await tx.reservationRoom.findFirst({
          where: {
            roomTypeId,
            reservation: {
              hotelId,
              status: {
                in: [...BLOCKING_RESERVATION_STATUSES],
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (activeReservationUsage) {
          throw new Error("ROOM_TYPE_ACTIVE_RESERVATION_USAGE");
        }
      }

      await tx.roomType.update({
        where: {
          id: roomTypeId,
        },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          basePrice: input.basePrice,
          capacityAdults: input.capacityAdults,
          capacityChildren: input.capacityChildren,
          bedType: input.bedType,
          roomSizeSqm: input.roomSizeSqm,
        },
      });

      if (input.amenityIds !== undefined) {
        await tx.roomTypeAmenity.deleteMany({
          where: {
            roomTypeId,
          },
        });

        if (input.amenityIds.length > 0) {
          await tx.roomTypeAmenity.createMany({
            data: input.amenityIds.map((amenityId) => ({
              roomTypeId,
              amenityId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (input.images !== undefined) {
        await tx.roomTypeImage.deleteMany({
          where: {
            roomTypeId,
          },
        });

        if (input.images.length > 0) {
          await tx.roomTypeImage.createMany({
            data: input.images.map((image) => ({
              roomTypeId,
              url: image.url,
              altText: image.altText,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            })),
          });
        }
      }

      const updatedRoomType = await tx.roomType.findFirst({
        where: {
          id: roomTypeId,
          hotelId,
          deletedAt: null,
        },
        select: getRoomTypeSelect(),
      });

      if (!updatedRoomType) {
        throw new Error("UPDATED_ROOM_TYPE_NOT_FOUND");
      }

      await createAuditLog(
        {
          hotelId,
          actorUserId: actor.id,
          action: "ROOM_TYPE_UPDATED",
          entityType: "RoomType",
          entityId: updatedRoomType.id,
          summary: `Room type ${updatedRoomType.name} was updated`,
          metadata: {
            previousName: existingRoomType.name,
            nextName: updatedRoomType.name,
            previousSlug: existingRoomType.slug,
            nextSlug: updatedRoomType.slug,
            descriptionChanged:
              existingRoomType.description !== updatedRoomType.description,
            previousBasePrice: Number(existingRoomType.basePrice),
            nextBasePrice: Number(updatedRoomType.basePrice),
            previousCapacityAdults: existingRoomType.capacityAdults,
            nextCapacityAdults: updatedRoomType.capacityAdults,
            previousCapacityChildren: existingRoomType.capacityChildren,
            nextCapacityChildren: updatedRoomType.capacityChildren,
            previousBedType: existingRoomType.bedType,
            nextBedType: updatedRoomType.bedType,
            imagesChanged: input.images !== undefined,
            amenitiesChanged: input.amenityIds !== undefined,
          },
        },
        tx,
      );

      return updatedRoomType;
    });

    return inventoryResponse({
      message: "Room type updated successfully",
      roomType: formatRoomTypeResponse(roomType),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ROOM_TYPE_ACTIVE_RESERVATION_USAGE"
    ) {
      return inventoryResponse(
        {
          error:
            "Cannot change core room type details while the room type is used by an active reservation",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return inventoryResponse(
        {
          error:
            "A unique constraint was violated while updating the room type",
        },
        { status: 409 },
      );
    }

    console.error("Update room type error:", error);

    return inventoryResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function deleteRoomType(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  roomTypeId: string,
) {
  const access = getInventoryWriteAccess(user, hotelId);
  if (!access.ok) return access.result;
  const actor = access.user;

  const existingRoomType = await database.roomType.findFirst({
    where: {
      id: roomTypeId,
      hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!existingRoomType) {
    return inventoryResponse({ error: "Room type not found" }, { status: 404 });
  }

  const activeRoomsCount = await database.room.count({
    where: {
      hotelId,
      roomTypeId,
      deletedAt: null,
    },
  });

  if (activeRoomsCount > 0) {
    return inventoryResponse(
      {
        error: "Cannot delete a room type while rooms still exist for it",
        roomTypeId: existingRoomType.id,
        roomTypeName: existingRoomType.name,
        roomCount: activeRoomsCount,
      },
      { status: 409 },
    );
  }

  const activeReservationUsage = await getActiveReservationUsageForRoomType(
    database,
    hotelId,
    roomTypeId,
  );

  if (activeReservationUsage) {
    return inventoryResponse(
      {
        error:
          "Cannot delete a room type that is used by an active reservation",
        roomTypeId: existingRoomType.id,
        roomTypeName: existingRoomType.name,
        reservationId: activeReservationUsage.reservation.id,
        reservationNumber: activeReservationUsage.reservation.reservationNumber,
        reservationStatus: activeReservationUsage.reservation.status,
      },
      { status: 409 },
    );
  }

  const reservationHistoryUsage = await getReservationHistoryUsageForRoomType(
    database,
    hotelId,
    roomTypeId,
  );

  if (reservationHistoryUsage) {
    return inventoryResponse(
      {
        error:
          "Cannot delete a room type that has reservation history. Keep it for audit/history purposes",
        roomTypeId: existingRoomType.id,
        roomTypeName: existingRoomType.name,
        reservationId: reservationHistoryUsage.reservation.id,
        reservationNumber:
          reservationHistoryUsage.reservation.reservationNumber,
        reservationStatus: reservationHistoryUsage.reservation.status,
      },
      { status: 409 },
    );
  }

  try {
    const roomType = await database.$transaction(async (tx) => {
      const activeRoomsCountInsideTransaction = await tx.room.count({
        where: {
          hotelId,
          roomTypeId,
          deletedAt: null,
        },
      });

      if (activeRoomsCountInsideTransaction > 0) {
        throw new Error("ROOM_TYPE_HAS_ROOMS");
      }

      const activeReservationUsageInsideTransaction =
        await tx.reservationRoom.findFirst({
          where: {
            roomTypeId,
            reservation: {
              hotelId,
              status: {
                in: [...BLOCKING_RESERVATION_STATUSES],
              },
            },
          },
          select: {
            id: true,
          },
        });

      if (activeReservationUsageInsideTransaction) {
        throw new Error("ROOM_TYPE_ACTIVE_RESERVATION_USAGE");
      }

      const reservationHistoryUsageInsideTransaction =
        await tx.reservationRoom.findFirst({
          where: {
            roomTypeId,
            reservation: {
              hotelId,
            },
          },
          select: {
            id: true,
          },
        });

      if (reservationHistoryUsageInsideTransaction) {
        throw new Error("ROOM_TYPE_HAS_RESERVATION_HISTORY");
      }

      const updateResult = await tx.roomType.updateMany({
        where: {
          id: roomTypeId,
          hotelId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (updateResult.count !== 1) {
        throw new Error("ROOM_TYPE_DELETE_FAILED");
      }

      const deletedRoomType = await tx.roomType.findFirst({
        where: {
          id: roomTypeId,
          hotelId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          deletedAt: true,
        },
      });

      if (!deletedRoomType) {
        throw new Error("DELETED_ROOM_TYPE_NOT_FOUND");
      }

      await createAuditLog(
        {
          hotelId,
          actorUserId: actor.id,
          action: "ROOM_TYPE_DELETED",
          entityType: "RoomType",
          entityId: deletedRoomType.id,
          summary: `Room type ${deletedRoomType.name} was deleted`,
          metadata: {
            name: deletedRoomType.name,
            slug: deletedRoomType.slug,
            deletedAt: deletedRoomType.deletedAt,
          },
        },
        tx,
      );

      return deletedRoomType;
    });

    return inventoryResponse({
      message: "Room type deleted successfully",
      roomType,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ROOM_TYPE_HAS_ROOMS") {
        return inventoryResponse(
          {
            error: "Cannot delete a room type while rooms still exist for it",
          },
          { status: 409 },
        );
      }

      if (error.message === "ROOM_TYPE_ACTIVE_RESERVATION_USAGE") {
        return inventoryResponse(
          {
            error:
              "Cannot delete a room type that is used by an active reservation",
          },
          { status: 409 },
        );
      }

      if (error.message === "ROOM_TYPE_HAS_RESERVATION_HISTORY") {
        return inventoryResponse(
          {
            error:
              "Cannot delete a room type that has reservation history. Keep it for audit/history purposes",
          },
          { status: 409 },
        );
      }
    }

    console.error("Delete room type error:", error);

    return inventoryResponse(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
