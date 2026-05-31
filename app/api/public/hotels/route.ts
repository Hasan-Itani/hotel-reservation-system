import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const hotels = await prisma.hotel.findMany({
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

  return NextResponse.json({
    hotels: hotels.map((hotel) => {
      const cheapestRoomType = hotel.roomTypes[0] ?? null;

      const primaryImage =
        hotel.roomTypes
          .flatMap((roomType) => roomType.images)
          .find((image) => image.isPrimary) ??
        hotel.roomTypes.flatMap((roomType) => roomType.images)[0] ??
        null;

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
  });
}