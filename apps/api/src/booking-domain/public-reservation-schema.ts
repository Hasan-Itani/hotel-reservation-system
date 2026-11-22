import { z } from "zod";

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be in YYYY-MM-DD format",
  })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    {
      message: "Date must be a valid calendar date",
    },
  );

export const reservationRoomInputSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    guests: z.coerce.number().int().min(1).max(20),
  })
  .strict();

function optionalText(max: number) {
  return z.string().trim().max(max).nullish().transform((value) => value || null);
}

export const publicReservationCreateSchema = z
  .object({
    guestFirstName: z.string().trim().min(1).max(100),
    guestLastName: z.string().trim().min(1).max(100),
    guestEmail: z.string().trim().toLowerCase().email(),
    guestPhone: optionalText(30),
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    specialRequests: optionalText(2000),
    rooms: z.array(reservationRoomInputSchema).min(1).max(10),
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
          "Selected rooms do not have enough total guest capacity for this booking",
      });
    }
  });

export type PublicReservationCreateInput = z.infer<typeof publicReservationCreateSchema>;
