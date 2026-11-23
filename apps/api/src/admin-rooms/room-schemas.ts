import { z } from "zod";
import { createNullableTrimmedString, updateNullableTrimmedString } from "../common/nullable-text";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must contain only lowercase letters, numbers, and hyphens",
  });

const roomTypeImageSchema = z
  .object({
    url: z.string().trim().url().max(2048),
    altText: createNullableTrimmedString(200),
    sortOrder: z.coerce.number().int().min(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();

function validateRoomTypeImages(
  images: Array<{
    url: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }>,
  ctx: z.RefinementCtx,
) {
  const usedSortOrders = new Set<number>();
  let primaryCount = 0;

  images.forEach((image, index) => {
    if (usedSortOrders.has(image.sortOrder)) {
      ctx.addIssue({
        code: "custom",
        path: ["images", index, "sortOrder"],
        message: "Each image must have a unique sortOrder",
      });
    } else {
      usedSortOrders.add(image.sortOrder);
    }

    if (image.isPrimary) {
      primaryCount += 1;
    }
  });

  if (primaryCount > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["images"],
      message: "Only one image can be marked as primary",
    });
  }
}

const manuallyManageableRoomStatusSchema = z.enum([
  "AVAILABLE",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
  "CLEANING",
]);

export const roomCreateSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    roomNumber: z.string().trim().min(1).max(20),
    floor: z
      .union([z.coerce.number().int(), z.null()])
      .optional()
      .transform((value) => value ?? null),
    status: manuallyManageableRoomStatusSchema.default("AVAILABLE"),
    notes: createNullableTrimmedString(1000),
  })
  .strict();

export const roomUpdateSchema = z
  .object({
    roomTypeId: z.string().uuid().optional(),
    roomNumber: z.string().trim().min(1).max(20).optional(),
    floor: z.union([z.coerce.number().int(), z.null()]).optional(),
    status: manuallyManageableRoomStatusSchema.optional(),
    notes: updateNullableTrimmedString(1000),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const roomTypeCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(),
    description: createNullableTrimmedString(2000),
    basePrice: z.coerce.number().min(0),
    capacityAdults: z.coerce.number().int().min(1).max(20),
    capacityChildren: z.coerce.number().int().min(0).max(20).default(0),
    bedType: createNullableTrimmedString(100),
    roomSizeSqm: z
      .union([z.coerce.number().positive(), z.null()])
      .optional()
      .transform((value) => value ?? null),
    amenityIds: z
      .array(z.string().uuid())
      .default([])
      .transform((ids) => [...new Set(ids)]),
    images: z.array(roomTypeImageSchema).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateRoomTypeImages(data.images, ctx);
  });

export const roomTypeUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    description: updateNullableTrimmedString(2000),
    basePrice: z.coerce.number().min(0).optional(),
    capacityAdults: z.coerce.number().int().min(1).max(20).optional(),
    capacityChildren: z.coerce.number().int().min(0).max(20).optional(),
    bedType: updateNullableTrimmedString(100),
    roomSizeSqm: z.union([z.coerce.number().positive(), z.null()]).optional(),
    amenityIds: z
      .array(z.string().uuid())
      .optional()
      .transform((ids) => {
        if (ids === undefined) return undefined;
        return [...new Set(ids)];
      }),
    images: z.array(roomTypeImageSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.images) {
      validateRoomTypeImages(data.images, ctx);
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
