import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import { roomTypeCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const roomTypes = await prisma.roomType.findMany({
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

  return NextResponse.json({
    hotelId,
    roomTypes: roomTypes.map((roomType) => ({
      ...roomType,
      amenities: roomType.amenities.map((item) => item.amenity),
    })),
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

  const canManageRoomTypes =
    hasGlobalRole(user, "SUPER_ADMIN") ||
    hasHotelRole(user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(user, hotelId, "MANAGER");

  if (!canManageRoomTypes) {
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

  const parsed = roomTypeCreateSchema.safeParse(body);

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
  const slug = input.slug ?? createSlug(input.name);

  if (!slug) {
    return NextResponse.json(
      { error: "Unable to generate a valid slug from the room type name" },
      { status: 400 },
    );
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

  const existingRoomType = await prisma.roomType.findFirst({
    where: {
      hotelId,
      slug,
    },
    select: {
      id: true,
    },
  });

  if (existingRoomType) {
    return NextResponse.json(
      { error: "A room type with this slug already exists for this hotel" },
      { status: 409 },
    );
  }

  if (input.amenityIds.length > 0) {
    const amenities = await prisma.amenity.findMany({
      where: {
        id: { in: input.amenityIds },
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
    const roomType = await prisma.roomType.create({
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

    return NextResponse.json(
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
      return NextResponse.json(
        {
          error:
            "A unique constraint was violated while creating the room type",
        },
        { status: 409 },
      );
    }

    console.error("Create room type error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
