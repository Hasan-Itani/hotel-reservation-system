import { z } from "zod";
import { dateOnlySchema, reservationRoomInputSchema } from "../booking-domain/public-reservation-schema";
import { createNullableTrimmedString, updateNullableTrimmedString } from "../common/nullable-text";

export const reservationCreateSchema = z
  .object({
    userId: z.string().uuid().optional(),
    guestFirstName: z.string().trim().min(1).max(100),
    guestLastName: z.string().trim().min(1).max(100),
    guestEmail: z.string().trim().toLowerCase().email(),
    guestPhone: createNullableTrimmedString(30),
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    specialRequests: createNullableTrimmedString(2000),
    discountAmount: z.coerce.number().min(0).default(0),
    serviceFee: z.coerce.number().min(0).default(0),
    taxes: z.coerce.number().min(0).default(0),
    rooms: z.array(reservationRoomInputSchema).min(1).max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.checkOutDate <= data.checkInDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message: "checkOutDate must be after checkInDate",
      });
    }

    const totalRequestedGuests = data.rooms.reduce(
      (sum, room) => sum + room.guests,
      0,
    );

    if (totalRequestedGuests < data.adults + data.children) {
      ctx.addIssue({
        code: "custom",
        path: ["rooms"],
        message:
          "Selected rooms do not have enough total guest capacity for this reservation",
      });
    }
  });

export const reservationStatusActionSchema = z.enum([
  "CONFIRM",
  "CANCEL",
  "CHECK_IN",
  "CHECK_OUT",
  "NO_SHOW",
]);

export const reservationRoomAssignmentSchema = z
  .object({
    reservationRoomId: z.string().uuid(),
    roomId: z.string().uuid(),
  })
  .strict();

export const reservationUpdateSchema = z
  .object({
    action: reservationStatusActionSchema,
    cancellationReason: updateNullableTrimmedString(1000),
    roomAssignments: z.array(reservationRoomAssignmentSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action !== "CANCEL" && data.cancellationReason !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["cancellationReason"],
        message: "cancellationReason is only allowed for CANCEL",
      });
    }

    if (data.action !== "CHECK_IN" && data.roomAssignments !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["roomAssignments"],
        message: "roomAssignments are only allowed for CHECK_IN",
      });
    }

    if (
      data.action === "CHECK_IN" &&
      (!data.roomAssignments || data.roomAssignments.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["roomAssignments"],
        message: "roomAssignments are required for CHECK_IN",
      });
    }

    if (data.roomAssignments) {
      const reservationRoomIds = new Set<string>();
      const roomIds = new Set<string>();

      data.roomAssignments.forEach((item, index) => {
        if (reservationRoomIds.has(item.reservationRoomId)) {
          ctx.addIssue({
            code: "custom",
            path: ["roomAssignments", index, "reservationRoomId"],
            message: "reservationRoomId must be unique",
          });
        } else {
          reservationRoomIds.add(item.reservationRoomId);
        }

        if (roomIds.has(item.roomId)) {
          ctx.addIssue({
            code: "custom",
            path: ["roomAssignments", index, "roomId"],
            message: "roomId must be unique",
          });
        } else {
          roomIds.add(item.roomId);
        }
      });
    }
  });
