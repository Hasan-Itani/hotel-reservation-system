import { Prisma, type PrismaClient } from "@prisma/client";
import { generateReservationNumber } from "./hotel-inventory";
import { lockHotelReservationInventory } from "./reservation-concurrency";
import { validateReservationRoomAvailability } from "./reservation-availability";
import { calculateReservationPricing, getRoomTypeNightlyPrice } from "./reservation-pricing";
import type { PublicReservationCreateInput } from "./public-reservation-schema";

class BookingRejected extends Error {
  constructor(readonly status: number, readonly body: { error: string }) {
    super(body.error);
  }
}

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

export async function createPublicReservation(
  database: PrismaClient,
  slug: string,
  user: { id: string; sessionVersion?: number },
  input: PublicReservationCreateInput,
) {
  try {
    const hotel = await database.hotel.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, currency: true },
    });
    if (!hotel) {
      return { status: 404, body: { error: "Hotel not found" } };
    }

    const reservation = await database.$transaction(
      async (tx) => {
        await lockHotelReservationInventory(tx, hotel.id);

        const account = await tx.user.findUnique({
          where: {
            id: user.id,
            deletedAt: null,
            status: "ACTIVE",
            ...(user.sessionVersion === undefined ? {} : { sessionVersion: user.sessionVersion }),
          },
          select: { email: true },
        });
        if (!account) {
          throw new BookingRejected(401, { error: "You must sign in before booking." });
        }

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
          throw new BookingRejected(availability.status, availability.body);
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
          throw new BookingRejected(pricing.status, pricing.body);
        }

        const { subtotal, taxes, serviceFee, discountAmount, total } = pricing;

        return tx.reservation.create({
          data: {
            reservationNumber: generateReservationNumber(),
            hotelId: hotel.id,
            userId: user.id,
            guestFirstName: input.guestFirstName,
            guestLastName: input.guestLastName,
            guestEmail: account.email,
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

    return {
      status: 201,
      body: {
        message: "Booking created successfully",
        reservation: serializePublicReservation(reservation),
      },
    };
  } catch (error) {
    if (error instanceof BookingRejected) {
      return { status: error.status, body: error.body };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { status: 409, body: { error: "A unique constraint was violated while creating the booking" } };
      }
      if (error.code === "P2034") {
        return { status: 409, body: { error: "Booking inventory changed while creating the booking. Please try again." } };
      }
    }

    console.error("Public booking error:", error);
    return {
      status: 500,
      body: { error: "We could not create your booking right now. Please try again in a moment." },
    };
  }
}
