import { Prisma, type PrismaClient } from "@prisma/client";
import { createAuditLog } from "../common/audit-log";
import type { AuthUser } from "../common/permissions";
import { BLOCKING_RESERVATION_STATUSES, generateReservationNumber } from "../booking-domain/hotel-inventory";
import { validateReservationRoomAvailability } from "../booking-domain/reservation-availability";
import { lockHotelReservationInventory } from "../booking-domain/reservation-concurrency";
import { calculateReservationPricing, getRoomTypeNightlyPrice } from "../booking-domain/reservation-pricing";
import { validateReservationActionTransition } from "../booking-domain/reservation-status";
import { getReservationSelect } from "./reservation-reads";
import { reservationCreateSchema, reservationUpdateSchema } from "./reservation-write-schemas";
import { requireReservationWriteAccess, writeResponse, type ReservationWriteResult } from "./reservation-write-access";

class ReservationRejected extends Error {
  constructor(readonly result: ReservationWriteResult) {
    super("Reservation rejected");
  }
}

export async function createAdminReservation(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  readBody: () => Promise<unknown>,
): Promise<ReservationWriteResult> {
  const access = requireReservationWriteAccess(user, hotelId);
  if (!access.ok) return access.result;

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return writeResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reservationCreateSchema.safeParse(body);

  if (!parsed.success) {
    return writeResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const input = parsed.data;

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
    return writeResponse({ error: "Hotel not found" }, { status: 404 });
  }

  if (input.userId) {
    const user = await database.user.findFirst({
      where: {
        id: input.userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return writeResponse({ error: "User not found" }, { status: 404 });
    }
  }

  try {
    const reservation = await database.$transaction(
      async (tx) => {
        await lockHotelReservationInventory(tx, hotelId);

        const availability = await validateReservationRoomAvailability({
          hotelId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          adults: input.adults,
          children: input.children,
          rooms: input.rooms,
          client: tx,
        });

        if (!availability.ok) {
          throw new ReservationRejected(writeResponse(availability.body, { status: availability.status }));
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
          throw new ReservationRejected(writeResponse(pricing.body, { status: pricing.status }));
        }

        const { subtotal, taxes, serviceFee, discountAmount, total } = pricing;

        const reservation = await tx.reservation.create({
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

        await createAuditLog(
          {
            hotelId,
            actorUserId: access.user.id,
            action: "RESERVATION_CREATED",
            entityType: "Reservation",
            entityId: reservation.id,
            summary: `Reservation ${reservation.reservationNumber} was created`,
            metadata: {
              reservationNumber: reservation.reservationNumber,
              guestEmail: reservation.guestEmail,
              status: reservation.status,
              total: Number(reservation.total),
              currency: reservation.currency,
              source: "admin",
            },
          },
          tx,
        );

        return reservation;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return writeResponse(
      {
        message: "Reservation created successfully",
        reservation,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ReservationRejected) {
      return error.result;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return writeResponse(
        { error: "A unique constraint was violated while creating the reservation" },
        { status: 409 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return writeResponse(
        {
          error:
            "Reservation inventory changed while creating the reservation. Please try again.",
        },
        { status: 409 }
      );
    }

    console.error("Create reservation error:", error);

    return writeResponse(
      {
        error:
          "We could not create the reservation right now. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function updateAdminReservation(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  reservationId: string,
  readBody: () => Promise<unknown>,
): Promise<ReservationWriteResult> {
  const access = requireReservationWriteAccess(user, hotelId);
  if (!access.ok) return access.result;

  let body: unknown;

  try {
    body = await readBody();
  } catch {
    return writeResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reservationUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return writeResponse(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const existingReservation = await database.reservation.findFirst({
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
    return writeResponse(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  const transition = validateReservationActionTransition({
    currentStatus: existingReservation.status,
    action: input.action,
  });

  if (!transition.ok) {
    return writeResponse(
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
    const reservation = await database.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
      select: getReservationSelect(),
    });

    await createAuditLog({
      hotelId,
      actorUserId: access.user.id,
      action: "RESERVATION_CONFIRMED",
      entityType: "Reservation",
      entityId: reservation.id,
      summary: `Reservation ${reservation.reservationNumber} was confirmed`,
      metadata: {
        reservationNumber: reservation.reservationNumber,
        previousStatus: existingReservation.status,
        nextStatus: reservation.status,
      },
    }, database);

    return writeResponse({
      message: "Reservation confirmed successfully",
      reservation,
    });
  }

  if (input.action === "CANCEL") {
    const reservation = await database.reservation.update({
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

    await createAuditLog({
      hotelId,
      actorUserId: access.user.id,
      action: "RESERVATION_CANCELLED",
      entityType: "Reservation",
      entityId: reservation.id,
      summary: `Reservation ${reservation.reservationNumber} was cancelled`,
      metadata: {
        reservationNumber: reservation.reservationNumber,
        previousStatus: existingReservation.status,
        nextStatus: reservation.status,
        cancellationReason: reservation.cancellationReason,
      },
    }, database);

    return writeResponse({
      message: "Reservation cancelled successfully",
      reservation,
    });
  }

  if (input.action === "NO_SHOW") {
    const reservation = await database.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: "NO_SHOW",
        noShowAt: new Date(),
      },
      select: getReservationSelect(),
    });

    await createAuditLog({
      hotelId,
      actorUserId: access.user.id,
      action: "RESERVATION_NO_SHOW",
      entityType: "Reservation",
      entityId: reservation.id,
      summary: `Reservation ${reservation.reservationNumber} was marked as no-show`,
      metadata: {
        reservationNumber: reservation.reservationNumber,
        previousStatus: existingReservation.status,
        nextStatus: reservation.status,
      },
    }, database);

    return writeResponse({
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
      return writeResponse(
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
        return writeResponse(
          {
            error:
              "One or more reservationRoomId values do not belong to this reservation",
          },
          { status: 400 },
        );
      }
    }

    const rooms = await database.room.findMany({
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
      return writeResponse(
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
        return writeResponse(
          {
            error: `Room ${room.roomNumber} does not match the required room type`,
            roomId: room.id,
            reservationRoomId: reservationRoom.id,
          },
          { status: 400 },
        );
      }

      if (room.status !== "AVAILABLE") {
        return writeResponse(
          {
            error: `Room ${room.roomNumber} is not available for check-in`,
            roomId: room.id,
            roomStatus: room.status,
          },
          { status: 409 },
        );
      }
    }

    const conflictingAssignments = await database.reservationRoom.findMany({
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
      return writeResponse(
        {
          error:
            "One or more rooms are already assigned to overlapping active reservations",
          conflicts: conflictingAssignments,
        },
        { status: 409 },
      );
    }

    try {
      const reservation = await database.$transaction(async (tx) => {
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

        await createAuditLog(
          {
            hotelId,
            actorUserId: access.user.id,
            action: "RESERVATION_CHECKED_IN",
            entityType: "Reservation",
            entityId: updatedReservation.id,
            summary: `Reservation ${updatedReservation.reservationNumber} was checked in`,
            metadata: {
              reservationNumber: updatedReservation.reservationNumber,
              previousStatus: existingReservation.status,
              nextStatus: updatedReservation.status,
              roomAssignments: assignments,
            },
          },
          tx,
        );

        return updatedReservation;
      });

      return writeResponse({
        message: "Reservation checked in successfully",
        reservation,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "ROOM_ASSIGNMENT_CONFLICT") {
          return writeResponse(
            {
              error:
                "One or more rooms are already assigned to overlapping active reservations",
            },
            { status: 409 },
          );
        }

        if (error.message === "ROOMS_NO_LONGER_AVAILABLE") {
          return writeResponse(
            {
              error: "One or more rooms are no longer available for check-in",
            },
            { status: 409 },
          );
        }

        if (error.message === "RESERVATION_STATUS_CHANGED") {
          return writeResponse(
            {
              error:
                "Reservation status changed before check-in could complete",
            },
            { status: 409 },
          );
        }
      }

      console.error("Check-in reservation error:", error);

      return writeResponse(
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
      return writeResponse(
        {
          error:
            "Cannot check out reservation because one or more rooms are not assigned",
        },
        { status: 409 },
      );
    }

    try {
      const reservation = await database.$transaction(async (tx) => {
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

        await createAuditLog(
          {
            hotelId,
            actorUserId: access.user.id,
            action: "RESERVATION_CHECKED_OUT",
            entityType: "Reservation",
            entityId: updatedReservation.id,
            summary: `Reservation ${updatedReservation.reservationNumber} was checked out`,
            metadata: {
              reservationNumber: updatedReservation.reservationNumber,
              previousStatus: existingReservation.status,
              nextStatus: updatedReservation.status,
              releasedRoomIds: assignedRoomIds,
            },
          },
          tx,
        );

        return updatedReservation;
      });

      return writeResponse({
        message: "Reservation checked out successfully",
        reservation,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "RESERVATION_STATUS_CHANGED"
      ) {
        return writeResponse(
          {
            error: "Reservation status changed before check-out could complete",
          },
          { status: 409 },
        );
      }

      console.error("Check-out reservation error:", error);

      return writeResponse(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  }

  return writeResponse({ error: "Unsupported action" }, { status: 400 });
}
