import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/getClientIp";
import { SELLABLE_ROOM_STATUSES } from "@/lib/hotelInventory";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { roundMoney } from "@/lib/reservationPayments";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `public-room-types:${ip}:${slug}`,
    windowMs: 5 * 60 * 1000,
    maxRequests: 120,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many room type requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limiter.retryAfterSeconds),
          ...rateLimitHeaders(limiter),
        },
      },
    );
  }

  const hotel = await prisma.hotel.findFirst({
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
    return NextResponse.json(
      { error: "Hotel not found" },
      {
        status: 404,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const roomTypes = await prisma.roomType.findMany({
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
                in: [...SELLABLE_ROOM_STATUSES],
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

  return NextResponse.json(
    {
      hotel: {
        name: hotel.name,
        slug: hotel.slug,
        currency: hotel.currency,
      },
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
    },
    {
      headers: rateLimitHeaders(limiter),
    },
  );
}