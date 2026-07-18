import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { generateReservationNumber } from "@/lib/hotelInventory";
import { lockHotelReservationInventory } from "@/lib/reservationConcurrency";
import { validateReservationRoomAvailability } from "@/lib/reservationAvailability";
import { publicReservationCreateSchema } from "@/lib/validators";
import {
  calculateReservationPricing,
  getRoomTypeNightlyPrice,
} from "@/lib/reservationPricing";
import { getCurrentAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function serializePublicReservation(reservation: {
  reservationNumber: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  specialRequests: string | null;
  status: string;
  subtotal: Prisma.Decimal;
  taxes: Prisma.Decimal;
  total: Prisma.Decimal;
  currency: string;
  discountAmount: Prisma.Decimal;
  serviceFee: Prisma.Decimal;
  createdAt: Date;
  reservationRooms: Array<{
    nightlyPrice: Prisma.Decimal;
    guests: number;
    roomType: {
      id: string;
      name: string;
      slug: string;
      basePrice: Prisma.Decimal;
      capacityAdults: number;
      capacityChildren: number;
      bedType: string | null;
    };
  }>;
}) {
  return {
    reservationNumber: reservation.reservationNumber,
    guestFirstName: reservation.guestFirstName,
    guestLastName: reservation.guestLastName,
    guestEmail: reservation.guestEmail,
    guestPhone: reservation.guestPhone,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    adults: reservation.adults,
    children: reservation.children,
    specialRequests: reservation.specialRequests,
    status: reservation.status,
    subtotal: reservation.subtotal,
    taxes: reservation.taxes,
    total: reservation.total,
    currency: reservation.currency,
    discountAmount: reservation.discountAmount,
    serviceFee: reservation.serviceFee,
    createdAt: reservation.createdAt,
    rooms: reservation.reservationRooms.map((reservationRoom) => ({
      nightlyPrice: reservationRoom.nightlyPrice,
      guests: reservationRoom.guests,
      roomType: reservationRoom.roomType,
    })),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `public-booking-create:${ip}:${slug}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
  });

  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "You must sign in before booking.",
      },
      {
        status: 401,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many booking attempts. Please try again later.",
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const parsed = publicReservationCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const input = parsed.data;

  const hotel = await prisma.hotel.findFirst({
    where: {
      slug,
      deletedAt: null,
    },
    select: {
      id: true,
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

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        await lockHotelReservationInventory(tx, hotel.id);

        const availability = await validateReservationRoomAvailability({
          hotelId: hotel.id,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          adults: input.adults,
          children: input.children,
          rooms: input.rooms,
          client: tx,
        });

        if (!availability.ok) {
          throw new Response(JSON.stringify(availability.body), {
            status: availability.status,
          });
        }

        const { checkIn, checkOut, nights, roomTypeMap } = availability;

        const pricing = calculateReservationPricing({
          nights,
          rooms: input.rooms,
          roomTypeMap,
          taxes: 0,
          serviceFee: 0,
          discountAmount: 0,
        });

        if (!pricing.ok) {
          throw new Response(JSON.stringify(pricing.body), {
            status: pricing.status,
          });
        }

        const { subtotal, taxes, serviceFee, discountAmount, total } = pricing;

        return tx.reservation.create({
          data: {
            reservationNumber: generateReservationNumber(),
            hotelId: hotel.id,
            userId: user.id,
            guestFirstName: input.guestFirstName,
            guestLastName: input.guestLastName,
            guestEmail: user.email,
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
            reservationNumber: true,
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
            reservationRooms: {
              select: {
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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json(
      {
        message: "Booking created successfully",
        reservation: serializePublicReservation(reservation),
      },
      {
        status: 201,
        headers: rateLimitHeaders(limiter),
      },
    );
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(await error.json(), {
        status: error.status,
        headers: rateLimitHeaders(limiter),
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "A unique constraint was violated while creating the booking",
        },
        {
          status: 409,
          headers: rateLimitHeaders(limiter),
        },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "Booking inventory changed while creating the booking. Please try again.",
        },
        {
          status: 409,
          headers: rateLimitHeaders(limiter),
        },
      );
    }

    console.error("Public booking error:", error);

    return NextResponse.json(
      {
        error:
          "We could not create your booking right now. Please try again in a moment.",
      },
      {
        status: 500,
        headers: rateLimitHeaders(limiter),
      },
    );
  }
}
