import type { Prisma, PrismaClient } from "@prisma/client";
import { parseDateOnlyToUtc } from "../booking-domain/hotel-inventory";
import { reservationListQuerySchema } from "./reservation-list-query";
import { canRefundReservation } from "./refund-policy";

type ReadResult = { status: number; body: object };

const reservationSummarySelect = {
  id: true,
  reservationNumber: true,
  guestFirstName: true,
  guestLastName: true,
} satisfies Prisma.ReservationSelect;

function readResponse(body: object, { status = 200 }: { status?: number } = {}): ReadResult {
  return { body, status };
}

export function getReservationSelect() {
  return {
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
    updatedAt: true,
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
      orderBy: {
        createdAt: "asc",
      },
    },
  } satisfies Prisma.ReservationSelect;
}

async function getReservationById(database: PrismaClient, hotelId: string, reservationId: string) {
  return database.reservation.findFirst({
    where: {
      id: reservationId,
      hotelId,
    },
    select: getReservationSelect(),
  });
}

export async function listAdminReservations(
  database: PrismaClient,
  hotelId: string,
  searchParams: URLSearchParams,
) {
  const parsed = reservationListQuerySchema.safeParse({
    view: searchParams.get("view") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    guestEmail: searchParams.get("guestEmail") ?? undefined,
    checkInFrom: searchParams.get("checkInFrom") ?? undefined,
    checkInTo: searchParams.get("checkInTo") ?? undefined,
    checkOutFrom: searchParams.get("checkOutFrom") ?? undefined,
    checkOutTo: searchParams.get("checkOutTo") ?? undefined,
  });

  if (!parsed.success) {
    return readResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const query = parsed.data;

  const hotel = await database.hotel.findFirst({
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
    return readResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const reservations = await database.reservation.findMany({
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
    select: query.view === "summary" ? reservationSummarySelect : {
      ...reservationSummarySelect,
      hotelId: true,
      userId: true,
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

  return readResponse({
    hotelId: hotel.id,
    hotelName: hotel.name,
    reservations,
  });
}

export async function readAdminReservation(
  database: PrismaClient,
  hotelId: string,
  reservationId: string,
) {
  const reservation = await getReservationById(database, hotelId, reservationId);

  if (!reservation) {
    return readResponse(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  return readResponse({ reservation });
}

export async function listAdminReservationPayments(
  database: PrismaClient,
  hotelId: string,
  reservationId: string,
) {
  const reservation = await database.reservation.findFirst({
    where: {
      id: reservationId,
      hotelId,
    },
    select: {
      id: true,
      reservationNumber: true,
      status: true,
      total: true,
      currency: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      checkOutDate: true,
      hotel: { select: { timezone: true } },
      payments: {
        select: {
          id: true,
          reservationId: true,
          provider: true,
          providerReference: true,
          methodLabel: true,
          cardLast4: true,
          cardHolderName: true,
          isMock: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!reservation) {
    return readResponse(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  const { checkOutDate, hotel, ...summary } = reservation;
  const refundAllowed = canRefundReservation({ status: summary.status, checkOutDate, hotel });
  return readResponse({ reservation: { ...summary, refundAllowed } });
}

export async function readAdminReservationPayment(
  database: PrismaClient,
  hotelId: string,
  reservationId: string,
  paymentId: string,
) {
  const payment = await database.payment.findFirst({
    where: {
      id: paymentId,
      reservationId,
      reservation: {
        hotelId,
      },
    },
    select: {
      id: true,
      reservationId: true,
      provider: true,
      providerReference: true,
      methodLabel: true,
      cardLast4: true,
      cardHolderName: true,
      isMock: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      reservation: {
        select: {
          id: true,
          reservationNumber: true,
          status: true,
          total: true,
          currency: true,
        },
      },
    },
  });

  if (!payment) {
    return readResponse({ error: "Payment not found" }, { status: 404 });
  }

  return readResponse({ payment });
}
