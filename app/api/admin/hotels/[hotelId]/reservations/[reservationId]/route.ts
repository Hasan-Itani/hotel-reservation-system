import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { hasGlobalRole, hasHotelRole } from "@/lib/permissions";
import { reservationUpdateSchema } from "@/lib/validators";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/hotelInventory";
import { validateReservationActionTransition } from "@/lib/reservationStatus";

export const dynamic = "force-dynamic";

function getReservationSelect() {
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

async function getReservationById(hotelId: string, reservationId: string) {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      hotelId,
    },
    select: getReservationSelect(),
  });
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; reservationId: string }>;
  },
) {
  const { hotelId, reservationId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const reservation = await getReservationById(hotelId, reservationId);

  if (!reservation) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ reservation });
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; reservationId: string }>;
  },
) {
  const { hotelId, reservationId } = await params;

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
        error:
          "Requires HOTEL_ADMIN, MANAGER, or RECEPTIONIST role for this hotel",
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

  const parsed = reservationUpdateSchema.safeParse(body);

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

  const existingReservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      hotelId,
    },
    select: {
      id: true,
      hotelId: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      reservationRooms: {
        select: {
          id: true,
          roomId: true,
          roomTypeId: true,
        },
      },
    },
  });

  if (!existingReservation) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  const transition = validateReservationActionTransition({
    currentStatus: existingReservation.status,
    action: input.action,
  });

  if (!transition.ok) {
    return NextResponse.json(
      {
        error: transition.error,
        currentStatus: transition.currentStatus,
        nextStatus: transition.nextStatus,
        allowedStatuses: transition.allowedStatuses,
      },
      { status: 409 },
    );
  }

  if (input.action === "CONFIRM") {
    const reservation = await prisma.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
      select: getReservationSelect(),
    });

    return NextResponse.json({
      message: "Reservation confirmed successfully",
      reservation,
    });
  }

  if (input.action === "CANCEL") {
    const reservation = await prisma.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: input.cancellationReason ?? null,
      },
      select: getReservationSelect(),
    });

    return NextResponse.json({
      message: "Reservation cancelled successfully",
      reservation,
    });
  }

  if (input.action === "NO_SHOW") {
    const reservation = await prisma.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: "NO_SHOW",
        noShowAt: new Date(),
      },
      select: getReservationSelect(),
    });

    return NextResponse.json({
      message: "Reservation marked as no-show successfully",
      reservation,
    });
  }

  if (input.action === "CHECK_IN") {
    const assignments = input.roomAssignments ?? [];
    const reservationRoomIds = assignments.map(
      (item) => item.reservationRoomId,
    );
    const roomIds = assignments.map((item) => item.roomId);

    if (assignments.length !== existingReservation.reservationRooms.length) {
      return NextResponse.json(
        {
          error:
            "You must assign rooms for all reservationRooms before check-in",
        },
        { status: 400 },
      );
    }

    const existingReservationRoomIds = new Set(
      existingReservation.reservationRooms.map((item) => item.id),
    );

    for (const reservationRoomId of reservationRoomIds) {
      if (!existingReservationRoomIds.has(reservationRoomId)) {
        return NextResponse.json(
          {
            error:
              "One or more reservationRoomId values do not belong to this reservation",
          },
          { status: 400 },
        );
      }
    }

    const rooms = await prisma.room.findMany({
      where: {
        id: {
          in: roomIds,
        },
        hotelId,
        deletedAt: null,
      },
      select: {
        id: true,
        roomNumber: true,
        roomTypeId: true,
        status: true,
      },
    });

    if (rooms.length !== roomIds.length) {
      return NextResponse.json(
        { error: "One or more roomId values are invalid for this hotel" },
        { status: 400 },
      );
    }

    const roomMap = new Map(rooms.map((room) => [room.id, room]));
    const reservationRoomMap = new Map(
      existingReservation.reservationRooms.map((item) => [item.id, item]),
    );

    for (const assignment of assignments) {
      const room = roomMap.get(assignment.roomId)!;
      const reservationRoom = reservationRoomMap.get(
        assignment.reservationRoomId,
      )!;

      if (room.roomTypeId !== reservationRoom.roomTypeId) {
        return NextResponse.json(
          {
            error: `Room ${room.roomNumber} does not match the required room type`,
            roomId: room.id,
            reservationRoomId: reservationRoom.id,
          },
          { status: 400 },
        );
      }

      if (room.status !== "AVAILABLE") {
        return NextResponse.json(
          {
            error: `Room ${room.roomNumber} is not available for check-in`,
            roomId: room.id,
            roomStatus: room.status,
          },
          { status: 409 },
        );
      }
    }

    const conflictingAssignments = await prisma.reservationRoom.findMany({
      where: {
        roomId: {
          in: roomIds,
        },
        reservationId: {
          not: reservationId,
        },
        reservation: {
          hotelId,
          status: {
            in: [...BLOCKING_RESERVATION_STATUSES],
          },
          checkInDate: {
            lt: existingReservation.checkOutDate,
          },
          checkOutDate: {
            gt: existingReservation.checkInDate,
          },
        },
      },
      select: {
        id: true,
        roomId: true,
        reservationId: true,
      },
    });

    if (conflictingAssignments.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more rooms are already assigned to overlapping active reservations",
          conflicts: conflictingAssignments,
        },
        { status: 409 },
      );
    }

    try {
      const reservation = await prisma.$transaction(async (tx) => {
        const freshConflictingAssignments = await tx.reservationRoom.findMany({
          where: {
            roomId: {
              in: roomIds,
            },
            reservationId: {
              not: reservationId,
            },
            reservation: {
              hotelId,
              status: {
                in: [...BLOCKING_RESERVATION_STATUSES],
              },
              checkInDate: {
                lt: existingReservation.checkOutDate,
              },
              checkOutDate: {
                gt: existingReservation.checkInDate,
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (freshConflictingAssignments.length > 0) {
          throw new Error("ROOM_ASSIGNMENT_CONFLICT");
        }

        const roomUpdateResult = await tx.room.updateMany({
          where: {
            id: {
              in: roomIds,
            },
            hotelId,
            deletedAt: null,
            status: "AVAILABLE",
          },
          data: {
            status: "OCCUPIED",
          },
        });

        if (roomUpdateResult.count !== roomIds.length) {
          throw new Error("ROOMS_NO_LONGER_AVAILABLE");
        }

        for (const assignment of assignments) {
          await tx.reservationRoom.update({
            where: {
              id: assignment.reservationRoomId,
            },
            data: {
              roomId: assignment.roomId,
            },
          });
        }

        const reservationUpdateResult = await tx.reservation.updateMany({
          where: {
            id: reservationId,
            hotelId,
            status: "CONFIRMED",
          },
          data: {
            status: "CHECKED_IN",
            checkedInAt: new Date(),
          },
        });

        if (reservationUpdateResult.count !== 1) {
          throw new Error("RESERVATION_STATUS_CHANGED");
        }

        const updatedReservation = await tx.reservation.findFirst({
          where: {
            id: reservationId,
            hotelId,
          },
          select: getReservationSelect(),
        });

        if (!updatedReservation) {
          throw new Error("UPDATED_RESERVATION_NOT_FOUND");
        }

        return updatedReservation;
      });

      return NextResponse.json({
        message: "Reservation checked in successfully",
        reservation,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "ROOM_ASSIGNMENT_CONFLICT") {
          return NextResponse.json(
            {
              error:
                "One or more rooms are already assigned to overlapping active reservations",
            },
            { status: 409 },
          );
        }

        if (error.message === "ROOMS_NO_LONGER_AVAILABLE") {
          return NextResponse.json(
            {
              error: "One or more rooms are no longer available for check-in",
            },
            { status: 409 },
          );
        }

        if (error.message === "RESERVATION_STATUS_CHANGED") {
          return NextResponse.json(
            {
              error:
                "Reservation status changed before check-in could complete",
            },
            { status: 409 },
          );
        }
      }

      console.error("Check-in reservation error:", error);

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  }

  if (input.action === "CHECK_OUT") {
    const assignedRoomIds = existingReservation.reservationRooms
      .map((item) => item.roomId)
      .filter((roomId): roomId is string => Boolean(roomId));

    if (
      assignedRoomIds.length !== existingReservation.reservationRooms.length
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot check out reservation because one or more rooms are not assigned",
        },
        { status: 409 },
      );
    }

    try {
      const reservation = await prisma.$transaction(async (tx) => {
        await tx.room.updateMany({
          where: {
            id: {
              in: assignedRoomIds,
            },
            hotelId,
            deletedAt: null,
          },
          data: {
            status: "AVAILABLE",
          },
        });

        const reservationUpdateResult = await tx.reservation.updateMany({
          where: {
            id: reservationId,
            hotelId,
            status: "CHECKED_IN",
          },
          data: {
            status: "CHECKED_OUT",
            checkedOutAt: new Date(),
          },
        });

        if (reservationUpdateResult.count !== 1) {
          throw new Error("RESERVATION_STATUS_CHANGED");
        }

        const updatedReservation = await tx.reservation.findFirst({
          where: {
            id: reservationId,
            hotelId,
          },
          select: getReservationSelect(),
        });

        if (!updatedReservation) {
          throw new Error("UPDATED_RESERVATION_NOT_FOUND");
        }

        return updatedReservation;
      });

      return NextResponse.json({
        message: "Reservation checked out successfully",
        reservation,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "RESERVATION_STATUS_CHANGED"
      ) {
        return NextResponse.json(
          {
            error: "Reservation status changed before check-out could complete",
          },
          { status: 409 },
        );
      }

      console.error("Check-out reservation error:", error);

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
