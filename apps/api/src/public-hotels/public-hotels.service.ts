import { Inject, Injectable } from "@nestjs/common";
import { RoomStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

const SELLABLE_ROOM_STATUSES = [
  RoomStatus.AVAILABLE,
  RoomStatus.OCCUPIED,
  RoomStatus.CLEANING,
];

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PublicHotelsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll() {
    const hotels = await this.prisma.hotel.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        country: true,
        city: true,
        addressLine1: true,
        starRating: true,
        checkInTime: true,
        checkOutTime: true,
        currency: true,
        timezone: true,
        roomTypes: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            basePrice: true,
            capacityAdults: true,
            capacityChildren: true,
            images: {
              select: {
                id: true,
                url: true,
                altText: true,
                isPrimary: true,
                sortOrder: true,
              },
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
          orderBy: {
            basePrice: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      hotels: hotels.map((hotel) => {
        const cheapestRoomType = hotel.roomTypes[0] ?? null;
        const images = hotel.roomTypes.flatMap((roomType) => roomType.images);
        const primaryImage =
          images.find((image) => image.isPrimary) ?? images[0] ?? null;

        return {
          id: hotel.id,
          name: hotel.name,
          slug: hotel.slug,
          description: hotel.description,
          country: hotel.country,
          city: hotel.city,
          addressLine1: hotel.addressLine1,
          starRating: hotel.starRating,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
          currency: hotel.currency,
          timezone: hotel.timezone,
          startingPrice: cheapestRoomType
            ? Number(cheapestRoomType.basePrice)
            : null,
          primaryImage,
          roomTypeCount: hotel.roomTypes.length,
        };
      }),
    };
  }

  async findBySlug(slug: string) {
    return this.prisma.hotel.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        email: true,
        phone: true,
        country: true,
        city: true,
        addressLine1: true,
        addressLine2: true,
        postalCode: true,
        starRating: true,
        checkInTime: true,
        checkOutTime: true,
        currency: true,
        timezone: true,
      },
    });
  }

  async findRoomTypes(slug: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
      select: {
        name: true,
        slug: true,
        currency: true,
      },
    });

    if (!hotel) {
      return null;
    }

    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        hotel: {
          slug,
          deletedAt: null,
        },
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
        _count: {
          select: {
            rooms: {
              where: {
                deletedAt: null,
                status: {
                  in: SELLABLE_ROOM_STATUSES,
                },
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
      hotel,
      roomTypes: roomTypes.map((roomType) => ({
        id: roomType.id,
        name: roomType.name,
        slug: roomType.slug,
        description: roomType.description,
        basePrice: roundMoney(Number(roomType.basePrice)),
        capacityAdults: roomType.capacityAdults,
        capacityChildren: roomType.capacityChildren,
        bedType: roomType.bedType,
        roomSizeSqm:
          roomType.roomSizeSqm === null
            ? null
            : roundMoney(Number(roomType.roomSizeSqm)),
        totalRooms: roomType._count.rooms,
        images: roomType.images,
        amenities: roomType.amenities.map((item) => item.amenity),
      })),
    };
  }
}
