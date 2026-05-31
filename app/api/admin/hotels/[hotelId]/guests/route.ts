import { NextResponse } from "next/server";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import { roundMoney } from "@/lib/reservationPayments";

export const dynamic = "force-dynamic";

type PermissionUser = Parameters<typeof hasGlobalRole>[0];

function canViewHotelGuests(input: { user: PermissionUser; hotelId: string }) {
  return (
    hasGlobalRole(input.user, "SUPER_ADMIN") ||
    hasHotelRole(input.user, input.hotelId, "HOTEL_ADMIN") ||
    hasHotelRole(input.user, input.hotelId, "MANAGER") ||
    hasHotelRole(input.user, input.hotelId, "RECEPTIONIST")
  );
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

  if (!canViewHotelGuests({ user: auth.user, hotelId })) {
    return NextResponse.json(
      {
        error:
          "Requires HOTEL_ADMIN, MANAGER, or RECEPTIONIST role for this hotel",
      },
      { status: 403 },
    );
  }

  const hotel = await prisma.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      hotel: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      reservationNumber: true,
      userId: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      guestPhone: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      total: true,
      currency: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      },
      payments: {
        select: {
          amount: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const guestMap = new Map<
    string,
    {
      key: string;
      userId: string | null;
      accountLinked: boolean;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      status: string | null;
      accountCreatedAt: Date | null;
      totalReservations: number;
      totalBooked: number;
      totalPaid: number;
      latestReservation: {
        reservationNumber: string;
        status: string;
        checkInDate: Date;
        checkOutDate: Date;
        total: number;
        currency: string;
        createdAt: Date;
      } | null;
    }
  >();

  for (const reservation of reservations) {
    const key = reservation.userId
      ? `user:${reservation.userId}`
      : `email:${reservation.guestEmail.toLowerCase()}`;

    const paidAmount = reservation.payments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const existing = guestMap.get(key);

    if (!existing) {
      guestMap.set(key, {
        key,
        userId: reservation.userId,
        accountLinked: Boolean(reservation.userId),
        firstName: reservation.user?.firstName ?? reservation.guestFirstName,
        lastName: reservation.user?.lastName ?? reservation.guestLastName,
        email: reservation.user?.email ?? reservation.guestEmail,
        phone: reservation.user?.phone ?? reservation.guestPhone,
        status: reservation.user?.status ?? null,
        accountCreatedAt: reservation.user?.createdAt ?? null,
        totalReservations: 1,
        totalBooked: Number(reservation.total),
        totalPaid: paidAmount,
        latestReservation: {
          reservationNumber: reservation.reservationNumber,
          status: reservation.status,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          total: Number(reservation.total),
          currency: reservation.currency,
          createdAt: reservation.createdAt,
        },
      });

      continue;
    }

    existing.totalReservations += 1;
    existing.totalBooked += Number(reservation.total);
    existing.totalPaid += paidAmount;

    if (
      !existing.latestReservation ||
      reservation.createdAt > existing.latestReservation.createdAt
    ) {
      existing.latestReservation = {
        reservationNumber: reservation.reservationNumber,
        status: reservation.status,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        total: Number(reservation.total),
        currency: reservation.currency,
        createdAt: reservation.createdAt,
      };
    }
  }

  const guests = Array.from(guestMap.values())
    .map((guest) => ({
      ...guest,
      totalBooked: roundMoney(guest.totalBooked),
      totalPaid: roundMoney(guest.totalPaid),
      latestReservation: guest.latestReservation
        ? {
            ...guest.latestReservation,
            total: roundMoney(guest.latestReservation.total),
          }
        : null,
    }))
    .sort((a, b) => {
      const aDate = a.latestReservation?.createdAt?.getTime() ?? 0;
      const bDate = b.latestReservation?.createdAt?.getTime() ?? 0;

      return bDate - aDate;
    });

  return NextResponse.json({
    hotelId: hotel.id,
    hotelName: hotel.name,
    guests,
  });
}
