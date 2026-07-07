import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { requireHotelAccess } from "@/lib/guards";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/hotelInventory";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import { roomTypeUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type HotelAccessResult = Awaited<ReturnType<typeof requireHotelAccess>>;
type AuthorizedHotelAccess = Extract<HotelAccessResult, { ok: true }>;
type AuthorizedUser = AuthorizedHotelAccess["user"];

function canManageRoomTypes(user: AuthorizedUser, hotelId: string) {
  return (
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER")
  );
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

function getRoomTypeSelect() {
  return {
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
    updatedAt: true,
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
  } satisfies Prisma.RoomTypeSelect;
}

async function getRoomTypeById(hotelId: string, roomTypeId: string) {
  return prisma.roomType.findFirst({
    where: {
      id: roomTypeId,
      hotelId,
      deletedAt: null,
    },
    select: getRoomTypeSelect(),
  });
}

async function getActiveReservationUsageForRoomType(
  hotelId: string,
  roomTypeId: string,
) {
  return prisma.reservationRoom.findFirst({
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
  hotelId: string,
  roomTypeId: string,
) {
  return prisma.reservationRoom.findFirst({
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

function formatRoomTypeResponse(
  roomType: NonNullable<Awaited<ReturnType<typeof getRoomTypeById>>>,
) {
  return {
    ...roomType,
    amenities: roomType.amenities.map((item) => item.amenity),
  };
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; roomTypeId: string }>;
  },
) {
  const { hotelId, roomTypeId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const roomType = await getRoomTypeById(hotelId, roomTypeId);

  if (!roomType) {
    return NextResponse.json({ error: "Room type not found" }, { status: 404 });
  }

  return NextResponse.json({
    roomType: formatRoomTypeResponse(roomType),
  });
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; roomTypeId: string }>;
  },
) {
  const { hotelId, roomTypeId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  if (!canManageRoomTypes(auth.user, hotelId)) {
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

  const parsed = roomTypeUpdateSchema.safeParse(body);

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

  const existingRoomType = await prisma.roomType.findFirst({
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
    return NextResponse.json({ error: "Room type not found" }, { status: 404 });
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
      hotelId,
      roomTypeId,
    );

    if (activeReservationUsage) {
      return NextResponse.json(
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
    const duplicateSlug = await prisma.roomType.findFirst({
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
      return NextResponse.json(
        { error: "A room type with this slug already exists for this hotel" },
        { status: 409 },
      );
    }
  }

  if (input.amenityIds !== undefined && input.amenityIds.length > 0) {
    const amenities = await prisma.amenity.findMany({
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
      return NextResponse.json(
        { error: "One or more amenityIds are invalid" },
        { status: 400 },
      );
    }
  }

  try {
    const roomType = await prisma.$transaction(async (tx) => {
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
          actorUserId: auth.user.id,
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

    return NextResponse.json({
      message: "Room type updated successfully",
      roomType: formatRoomTypeResponse(roomType),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ROOM_TYPE_ACTIVE_RESERVATION_USAGE"
    ) {
      return NextResponse.json(
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
      return NextResponse.json(
        {
          error:
            "A unique constraint was violated while updating the room type",
        },
        { status: 409 },
      );
    }

    console.error("Update room type error:", error);

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
    params: Promise<{ hotelId: string; roomTypeId: string }>;
  },
) {
  const { hotelId, roomTypeId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  if (!canManageRoomTypes(auth.user, hotelId)) {
    return NextResponse.json(
      { error: "Requires HOTEL_ADMIN or MANAGER role for this hotel" },
      { status: 403 },
    );
  }

  const existingRoomType = await prisma.roomType.findFirst({
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
    return NextResponse.json({ error: "Room type not found" }, { status: 404 });
  }

  const activeRoomsCount = await prisma.room.count({
    where: {
      hotelId,
      roomTypeId,
      deletedAt: null,
    },
  });

  if (activeRoomsCount > 0) {
    return NextResponse.json(
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
    hotelId,
    roomTypeId,
  );

  if (activeReservationUsage) {
    return NextResponse.json(
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
    hotelId,
    roomTypeId,
  );

  if (reservationHistoryUsage) {
    return NextResponse.json(
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
    const roomType = await prisma.$transaction(async (tx) => {
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
          actorUserId: auth.user.id,
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

    return NextResponse.json({
      message: "Room type deleted successfully",
      roomType,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ROOM_TYPE_HAS_ROOMS") {
        return NextResponse.json(
          {
            error: "Cannot delete a room type while rooms still exist for it",
          },
          { status: 409 },
        );
      }

      if (error.message === "ROOM_TYPE_ACTIVE_RESERVATION_USAGE") {
        return NextResponse.json(
          {
            error:
              "Cannot delete a room type that is used by an active reservation",
          },
          { status: 409 },
        );
      }

      if (error.message === "ROOM_TYPE_HAS_RESERVATION_HISTORY") {
        return NextResponse.json(
          {
            error:
              "Cannot delete a room type that has reservation history. Keep it for audit/history purposes",
          },
          { status: 409 },
        );
      }
    }

    console.error("Delete room type error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
