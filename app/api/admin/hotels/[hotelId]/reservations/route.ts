import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import {
  generateReservationNumber,
  parseDateOnlyToUtc,
} from "@/lib/hotelInventory";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import { validateReservationRoomAvailability } from "@/lib/reservationAvailability";
import {
  reservationCreateSchema,
  reservationListQuerySchema,
} from "@/lib/validators";

import {
  calculateReservationPricing,
  getRoomTypeNightlyPrice,
} from "@/lib/reservationPricing";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> }
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);

  const parsed = reservationListQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    guestEmail: url.searchParams.get("guestEmail") ?? undefined,
    checkInFrom: url.searchParams.get("checkInFrom") ?? undefined,
    checkInTo: url.searchParams.get("checkInTo") ?? undefined,
    checkOutFrom: url.searchParams.get("checkOutFrom") ?? undefined,
    checkOutTo: url.searchParams.get("checkOutTo") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const query = parsed.data;

  const hotel = await prisma.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      currency: true,
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.guestEmail ? { guestEmail: query.guestEmail } : {}),
      ...(query.checkInFrom || query.checkInTo
        ? {
            checkInDate: {
              ...(query.checkInFrom
                ? { gte: parseDateOnlyToUtc(query.checkInFrom) }
                : {}),
              ...(query.checkInTo
                ? { lte: parseDateOnlyToUtc(query.checkInTo) }
                : {}),
            },
          }
        : {}),
      ...(query.checkOutFrom || query.checkOutTo
        ? {
            checkOutDate: {
              ...(query.checkOutFrom
                ? { gte: parseDateOnlyToUtc(query.checkOutFrom) }
                : {}),
              ...(query.checkOutTo
                ? { lte: parseDateOnlyToUtc(query.checkOutTo) }
                : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      reservationNumber: true,
      hotelId: true,
      userId: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      guestPhone: true,
      checkInDate: true,
      checkOutDate: true,
      adults: true,
      children: true,
      specialRequests: true,
      status: true,
      subtotal: true,
      taxes: true,
      total: true,
      currency: true,
      discountAmount: true,
      serviceFee: true,
      createdAt: true,
      confirmedAt: true,
      cancelledAt: true,
      checkedInAt: true,
      checkedOutAt: true,
      noShowAt: true,
      cancellationReason: true,
      reservationRooms: {
        select: {
          id: true,
          roomId: true,
          roomTypeId: true,
          nightlyPrice: true,
          guests: true,
          room: {
            select: {
              id: true,
              roomNumber: true,
              floor: true,
              status: true,
            },
          },
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
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    hotelId: hotel.id,
    hotelName: hotel.name,
    reservations,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> }
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const canManageReservations =
    hasGlobalRole(auth.user, "SUPER_ADMIN") ||
    hasHotelRole(auth.user, hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(auth.user, hotelId, "MANAGER") ||
    hasHotelRole(auth.user, hotelId, "RECEPTIONIST");

  if (!canManageReservations) {
    return NextResponse.json(
      {
        error: "Requires HOTEL_ADMIN, MANAGER, or RECEPTIONIST role for this hotel",
      },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reservationCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const hotel = await prisma.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      currency: true,
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  if (input.userId) {
    const user = await prisma.user.findFirst({
      where: {
        id: input.userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  const availability = await validateReservationRoomAvailability({
    hotelId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
  });

  if (!availability.ok) {
    return NextResponse.json(availability.body, {
      status: availability.status,
    });
  }

  const { checkIn, checkOut, nights, roomTypeMap } = availability;

const pricing = calculateReservationPricing({
  nights,
  rooms: input.rooms,
  roomTypeMap,
  taxes: input.taxes,
  serviceFee: input.serviceFee,
  discountAmount: input.discountAmount,
});

if (!pricing.ok) {
  return NextResponse.json(pricing.body, {
    status: pricing.status,
  });
}

const {
  subtotal,
  taxes,
  serviceFee,
  discountAmount,
  total,
} = pricing;

  try {
    const reservation = await prisma.reservation.create({
      data: {
        reservationNumber: generateReservationNumber(),
        hotelId,
        userId: input.userId,
        guestFirstName: input.guestFirstName,
        guestLastName: input.guestLastName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: input.adults,
        children: input.children,
        specialRequests: input.specialRequests,
        subtotal,
        taxes,
        total,
        currency: hotel.currency,
        discountAmount,
        serviceFee,
        reservationRooms: {
          create: input.rooms.map((room) => {
            const roomType = roomTypeMap.get(room.roomTypeId)!;

            return {
              roomTypeId: room.roomTypeId,
              nightlyPrice: getRoomTypeNightlyPrice(roomType),
              guests: room.guests,
            };
          }),
        },
      },
      select: {
        id: true,
        reservationNumber: true,
        hotelId: true,
        userId: true,
        guestFirstName: true,
        guestLastName: true,
        guestEmail: true,
        guestPhone: true,
        checkInDate: true,
        checkOutDate: true,
        adults: true,
        children: true,
        specialRequests: true,
        status: true,
        subtotal: true,
        taxes: true,
        total: true,
        currency: true,
        discountAmount: true,
        serviceFee: true,
        createdAt: true,
        confirmedAt: true,
        cancelledAt: true,
        checkedInAt: true,
        checkedOutAt: true,
        noShowAt: true,
        cancellationReason: true,
        reservationRooms: {
          select: {
            id: true,
            roomId: true,
            roomTypeId: true,
            nightlyPrice: true,
            guests: true,
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
        },
      },
    });

    return NextResponse.json(
      {
        message: "Reservation created successfully",
        reservation,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A unique constraint was violated while creating the reservation" },
        { status: 409 }
      );
    }

    console.error("Create reservation error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}