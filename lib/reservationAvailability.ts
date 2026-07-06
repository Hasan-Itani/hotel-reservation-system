import { Prisma } from "@prisma/client";
import {
  BLOCKING_RESERVATION_STATUSES,
  getNightCount,
  parseDateOnlyToUtc,
  SELLABLE_ROOM_STATUSES,
} from "@/lib/hotelInventory";
import { prisma } from "@/lib/prisma";

export type ReservationRoomRequest = {
  roomTypeId: string;
  guests: number;
};

type ReservationAvailabilityClient = Pick<
  typeof prisma,
  "roomType" | "reservationRoom"
>;

const roomTypeAvailabilitySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  basePrice: true,
  capacityAdults: true,
  capacityChildren: true,
  bedType: true,
  roomSizeSqm: true,
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
  _count: {
    select: {
      rooms: {
        where: {
          deletedAt: null,
          status: {
            in: [...SELLABLE_ROOM_STATUSES],
          },
        },
      },
    },
  },
} satisfies Prisma.RoomTypeSelect;

export type RoomTypeAvailabilityRecord = Prisma.RoomTypeGetPayload<{
  select: typeof roomTypeAvailabilitySelect;
}>;

export function getRequestedRoomTypeCounts(rooms: ReservationRoomRequest[]) {
  const requestedCounts = new Map<string, number>();

  for (const room of rooms) {
    requestedCounts.set(
      room.roomTypeId,
      (requestedCounts.get(room.roomTypeId) ?? 0) + 1,
    );
  }

  return requestedCounts;
}

export async function getRoomTypeAvailabilityForHotel(input: {
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  roomTypeIds?: string[];
  client?: ReservationAvailabilityClient;
}) {
  const client = input.client ?? prisma;
  const checkIn = parseDateOnlyToUtc(input.checkInDate);
  const checkOut = parseDateOnlyToUtc(input.checkOutDate);

  const roomTypes = await client.roomType.findMany({
    where: {
      hotelId: input.hotelId,
      deletedAt: null,
      ...(input.roomTypeIds
        ? {
            id: {
              in: input.roomTypeIds,
            },
          }
        : {}),
      ...(input.adults !== undefined
        ? { capacityAdults: { gte: input.adults } }
        : {}),
      ...(input.children !== undefined
        ? { capacityChildren: { gte: input.children } }
        : {}),
    },
    select: roomTypeAvailabilitySelect,
    orderBy: {
      createdAt: "asc",
    },
  });

  const overlappingReservedCounts = await client.reservationRoom.groupBy({
    by: ["roomTypeId"],
    where: {
      ...(input.roomTypeIds
        ? {
            roomTypeId: {
              in: input.roomTypeIds,
            },
          }
        : {}),
      reservation: {
        hotelId: input.hotelId,
        status: {
          in: [...BLOCKING_RESERVATION_STATUSES],
        },
        checkInDate: {
          lt: checkOut,
        },
        checkOutDate: {
          gt: checkIn,
        },
      },
    },
    _count: {
      _all: true,
    },
  });

  const reservedCountMap = new Map(
    overlappingReservedCounts.map((item) => [item.roomTypeId, item._count._all]),
  );

  const availability = roomTypes.map((roomType) => {
    const totalRooms = roomType._count.rooms;
    const reservedRooms = reservedCountMap.get(roomType.id) ?? 0;
    const availableRooms = Math.max(totalRooms - reservedRooms, 0);

    return {
      id: roomType.id,
      name: roomType.name,
      slug: roomType.slug,
      description: roomType.description,
      basePrice: roomType.basePrice,
      capacityAdults: roomType.capacityAdults,
      capacityChildren: roomType.capacityChildren,
      bedType: roomType.bedType,
      roomSizeSqm: roomType.roomSizeSqm,
      images: roomType.images,
      totalRooms,
      reservedRooms,
      availableRooms,
      isAvailable: availableRooms > 0,
    };
  });

  return {
    checkIn,
    checkOut,
    roomTypes,
    availability,
  };
}

export async function validateReservationRoomAvailability(input: {
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  rooms: ReservationRoomRequest[];
  client?: ReservationAvailabilityClient;
}) {
  const nights = getNightCount(input.checkInDate, input.checkOutDate);

  if (nights < 1) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "Reservation must be at least 1 night",
      },
    };
  }

  const roomTypeIds = [
    ...new Set(input.rooms.map((room) => room.roomTypeId)),
  ];

  const result = await getRoomTypeAvailabilityForHotel({
    hotelId: input.hotelId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomTypeIds,
    client: input.client,
  });

  if (result.roomTypes.length !== roomTypeIds.length) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "One or more roomTypeId values are invalid for this hotel",
      },
    };
  }

  const roomTypeMap = new Map(
    result.roomTypes.map((roomType) => [roomType.id, roomType]),
  );

  for (const room of input.rooms) {
    const roomType = roomTypeMap.get(room.roomTypeId)!;
    const maxGuests = roomType.capacityAdults + roomType.capacityChildren;

    if (room.guests > maxGuests) {
      return {
        ok: false as const,
        status: 400,
        body: {
          error: `Requested guests exceed capacity for room type ${roomType.name}`,
          roomTypeId: room.roomTypeId,
          guests: room.guests,
          maxGuests,
        },
      };
    }
  }

  const totalRequestedRoomGuests = input.rooms.reduce(
    (sum, room) => sum + room.guests,
    0,
  );

  const totalGuests = input.adults + input.children;

  if (totalRequestedRoomGuests < totalGuests) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error:
          "Selected rooms do not have enough total guest capacity for this reservation",
        totalGuests,
        totalRequestedRoomGuests,
      },
    };
  }

  const requestedCounts = getRequestedRoomTypeCounts(input.rooms);

  for (const [roomTypeId, requestedRooms] of requestedCounts.entries()) {
    const roomType = roomTypeMap.get(roomTypeId)!;
    const availability = result.availability.find(
      (item) => item.id === roomTypeId,
    )!;

    if (availability.availableRooms < requestedRooms) {
      return {
        ok: false as const,
        status: 409,
        body: {
          error: `Not enough availability for room type ${roomType.name}`,
          roomTypeId,
          requestedRooms,
          availableRooms: availability.availableRooms,
        },
      };
    }
  }

  return {
    ok: true as const,
    checkIn: result.checkIn,
    checkOut: result.checkOut,
    nights,
    roomTypeMap,
    availability: result.availability,
  };
}
