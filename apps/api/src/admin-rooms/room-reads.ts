import type { Prisma, PrismaClient } from "@prisma/client";

export function getRoomSelect() {
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

export async function listRooms(database: Pick<PrismaClient, "room">, hotelId: string) {
  const rooms = await database.room.findMany({
    where: {
      hotelId,
      deletedAt: null,
    },
    select: getRoomSelect(),
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });

  return {
    hotelId,
    rooms,
  };
}

export async function getRoomById(database: Pick<PrismaClient, "room">, hotelId: string, roomId: string) {
  return database.room.findFirst({
    where: {
      id: roomId,
      hotelId,
      deletedAt: null,
    },
    select: getRoomSelect(),
  });
}

export async function listRoomTypes(database: Pick<PrismaClient, "roomType">, hotelId: string) {
  const roomTypes = await database.roomType.findMany({
    where: {
      hotelId,
      deletedAt: null,
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
    orderBy: {
      createdAt: "asc",
    },
  });

  return {
    hotelId,
    roomTypes: roomTypes.map((roomType) => ({
      ...roomType,
      amenities: roomType.amenities.map((item) => item.amenity),
    })),
  };
}

export function getRoomTypeSelect() {
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

export async function getRoomTypeById(database: Pick<PrismaClient, "roomType">, hotelId: string, roomTypeId: string) {
  return database.roomType.findFirst({
    where: {
      id: roomTypeId,
      hotelId,
      deletedAt: null,
    },
    select: getRoomTypeSelect(),
  });
}

export function formatRoomTypeResponse(
  roomType: NonNullable<Awaited<ReturnType<typeof getRoomTypeById>>>,
) {
  return {
    ...roomType,
    amenities: roomType.amenities.map((item) => item.amenity),
  };
}
