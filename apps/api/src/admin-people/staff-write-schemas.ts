import { z } from "zod";
import { createNullableTrimmedString } from "../common/nullable-text";

const allowedHotelStaffRoleNames = [
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
] as const;

const hotelStaffRoleNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((value) => value.toUpperCase())
  .refine(
    (value) =>
      allowedHotelStaffRoleNames.includes(
        value as (typeof allowedHotelStaffRoleNames)[number],
      ),
    {
      message:
        "Hotel staff roles must be HOTEL_ADMIN, MANAGER, or RECEPTIONIST",
    },
  );

export const hotelStaffRoleNamesSchema = z
  .array(hotelStaffRoleNameSchema)
  .min(1)
  .transform((roleNames) => [...new Set(roleNames)]);

export const hotelStaffCreateSchema = z
  .object({
    userId: z.string().uuid().optional(),

    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: createNullableTrimmedString(30),
    password: z.string().min(8).max(100).optional(),

    roleNames: hotelStaffRoleNamesSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasExistingUserId = !!data.userId;

    const hasNewUserFields =
      !!data.firstName || !!data.lastName || !!data.email || !!data.password;

    if (hasExistingUserId && hasNewUserFields) {
      ctx.addIssue({
        code: "custom",
        message: "Use either userId or new staff fields, not both",
        path: ["userId"],
      });

      return;
    }

    if (!hasExistingUserId) {
      if (!data.firstName) {
        ctx.addIssue({
          code: "custom",
          message: "First name is required",
          path: ["firstName"],
        });
      }

      if (!data.lastName) {
        ctx.addIssue({
          code: "custom",
          message: "Last name is required",
          path: ["lastName"],
        });
      }

      if (!data.email) {
        ctx.addIssue({
          code: "custom",
          message: "Email is required",
          path: ["email"],
        });
      }

      if (!data.password) {
        ctx.addIssue({
          code: "custom",
          message: "Password is required",
          path: ["password"],
        });
      }
    }
  });

export const hotelStaffUpdateSchema = z
  .object({
    roleNames: hotelStaffRoleNamesSchema,
  })
  .strict();
