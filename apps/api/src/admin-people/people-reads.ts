import type { PrismaClient } from "@prisma/client";
import { roundMoney } from "../booking-domain/money";
import { canAccessHotel, hasGlobalRole, hasHotelRole, type AuthUser } from "../common/permissions";

type PeopleReadResult = { status: number; body: object };

function readResponse(body: object, { status = 200 }: { status?: number } = {}): PeopleReadResult {
  return { body, status };
}

function getGuestReadDenial(user: AuthUser | null, hotelId: string) {
  if (!user) {
    return readResponse({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHotel(user, hotelId)) {
    return readResponse({ error: "You do not have access to this hotel" }, { status: 403 });
  }
  if (
    !hasGlobalRole(user, "SUPER_ADMIN") &&
    !hasHotelRole(user, hotelId, "HOTEL_ADMIN") &&
    !hasHotelRole(user, hotelId, "MANAGER") &&
    !hasHotelRole(user, hotelId, "RECEPTIONIST")
  ) {
    return readResponse(
      { error: "Requires HOTEL_ADMIN, MANAGER, or RECEPTIONIST role for this hotel" },
      { status: 403 },
    );
  }
  return null;
}

function getStaffReadDenial(user: AuthUser | null, hotelId: string) {
  if (!user) {
    return readResponse({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasGlobalRole(user, "SUPER_ADMIN") && !hasHotelRole(user, hotelId, "HOTEL_ADMIN")) {
    return readResponse({ error: "Requires role HOTEL_ADMIN for this hotel" }, { status: 403 });
  }
  return null;
}

export async function getHotelById(database: Pick<PrismaClient, "hotel">, hotelId: string) {
  return database.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function getStaffAssignments(database: Pick<PrismaClient, "userHotelRole">, hotelId: string, userId?: string) {
  return database.userHotelRole.findMany({
    where: {
      hotelId,
      ...(userId ? { userId } : {}),
      User: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      roleId: true,
      createdAt: true,
      Role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      User: {
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
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export function mapStaff(assignments: Awaited<ReturnType<typeof getStaffAssignments>>) {
  const staffMap = new Map<
    string,
    {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      status: string;
      createdAt: Date;
      assignedAt: Date;
      roles: Array<{
        id: string;
        name: string;
        description: string | null;
      }>;
    }
  >();

  for (const assignment of assignments) {
    const existing = staffMap.get(assignment.User.id);

    if (!existing) {
      staffMap.set(assignment.User.id, {
        id: assignment.User.id,
        firstName: assignment.User.firstName,
        lastName: assignment.User.lastName,
        email: assignment.User.email,
        phone: assignment.User.phone,
        status: assignment.User.status,
        createdAt: assignment.User.createdAt,
        assignedAt: assignment.createdAt,
        roles: [
          {
            id: assignment.Role.id,
            name: assignment.Role.name,
            description: assignment.Role.description,
          },
        ],
      });

      continue;
    }

    existing.roles.push({
      id: assignment.Role.id,
      name: assignment.Role.name,
      description: assignment.Role.description,
    });
  }

  return Array.from(staffMap.values()).sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();

    return nameA.localeCompare(nameB);
  });
}

export function mapSingleStaff(assignments: Awaited<ReturnType<typeof getStaffAssignments>>) {
  return mapStaff(assignments)[0] ?? null;
}

export async function listAdminGuests(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
): Promise<PeopleReadResult> {
  const denied = getGuestReadDenial(user, hotelId);
  if (denied) return denied;

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return readResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const reservations = await database.reservation.findMany({
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
          failedLoginAttempts: true,
          lockedUntil: true,
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
      failedLoginAttempts: number | null;
      lockedUntil: Date | null;
      canUnlock: boolean;
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
  const now = new Date();

  for (const reservation of reservations) {
    const activeLockedUntil =
      reservation.user?.lockedUntil && reservation.user.lockedUntil > now
        ? reservation.user.lockedUntil
        : null;
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
        failedLoginAttempts: reservation.user?.failedLoginAttempts ?? null,
        lockedUntil: activeLockedUntil,
        canUnlock: Boolean(reservation.userId && activeLockedUntil),
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

  return readResponse({
    hotelId: hotel.id,
    hotelName: hotel.name,
    guests,
  });
}

export async function listAdminStaff(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
): Promise<PeopleReadResult> {
  const denied = getStaffReadDenial(user, hotelId);
  if (denied) return denied;

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return readResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const assignments = await getStaffAssignments(database, hotelId);

  return readResponse({
    hotelId: hotel.id,
    hotelName: hotel.name,
    staff: mapStaff(assignments),
  });
}

export async function readAdminStaff(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  staffId: string,
): Promise<PeopleReadResult> {
  const denied = getStaffReadDenial(user, hotelId);
  if (denied) return denied;

  const hotel = await getHotelById(database, hotelId);

  if (!hotel) {
    return readResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const assignments = await getStaffAssignments(database, hotelId, staffId);
  const staff = mapSingleStaff(assignments);

  if (!staff) {
    return readResponse(
      { error: "Staff member not found for this hotel" },
      { status: 404 },
    );
  }

  return readResponse({ staff });
}
