import type { Prisma, PrismaClient } from "@prisma/client";
import { createAuditLog } from "../common/audit-log";
import { canAccessHotel, type AuthUser } from "../common/permissions";
import { adminHotelInquiryUpdateSchema, publicHotelInquiryCreateSchema } from "./inquiry-schemas";
import { activityResponse, type ActivityResult } from "./activity-response";

const adminInquirySelect = {
  id: true,
  hotelId: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  inquiryType: true,
  subject: true,
  message: true,
  status: true,
  adminNote: true,
  readAt: true,
  repliedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  hotel: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.HotelInquirySelect;

function requireInquiryAccess(user: AuthUser | null, hotelId: string) {
  if (!user) {
    return { ok: false as const, result: activityResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccessHotel(user, hotelId)) {
    return { ok: false as const, result: activityResponse({ error: "You do not have access to this hotel" }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export async function listAdminInquiries(database: PrismaClient, user: AuthUser | null, hotelId: string): Promise<ActivityResult> {
  const access = requireInquiryAccess(user, hotelId);
  if (!access.ok) return access.result;

  const hotel = await database.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!hotel) {
    return activityResponse({ error: "Hotel not found" }, { status: 404 });
  }

  const inquiries = await database.hotelInquiry.findMany({
    where: {
      hotelId,
    },
    select: adminInquirySelect,
    orderBy: {
      createdAt: "desc",
    },
  });

  return activityResponse({
    hotelId,
    inquiries,
  });
}

export async function updateAdminInquiry(
  database: PrismaClient,
  user: AuthUser | null,
  hotelId: string,
  inquiryId: string,
  readBody: () => Promise<unknown>,
): Promise<ActivityResult> {
  const access = requireInquiryAccess(user, hotelId);
  if (!access.ok) return access.result;

  const body = await readBody().catch(() => null);
  const parsed = adminHotelInquiryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return activityResponse(
      {
        error: parsed.error.issues[0]?.message || "Invalid inquiry update",
      },
      { status: 400 },
    );
  }

  return database.$transaction(async (tx) => {
    const existingInquiry = await tx.hotelInquiry.findFirst({
      where: {
        id: inquiryId,
        hotelId,
      },
      select: adminInquirySelect,
    });

    if (!existingInquiry) {
      return activityResponse({ error: "Inquiry not found" }, { status: 404 });
    }

    const updateData: {
      status?: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
      adminNote?: string | null;
      readAt?: Date | null;
      repliedAt?: Date | null;
      archivedAt?: Date | null;
    } = {};

    const { status, adminNote } = parsed.data;
    if (status !== undefined && status !== existingInquiry.status) {
      updateData.status = status;

      if (parsed.data.status === "READ") {
        updateData.readAt = new Date();
      }

      if (parsed.data.status === "REPLIED") {
        updateData.readAt = new Date();
        updateData.repliedAt = new Date();
      }

      if (parsed.data.status === "ARCHIVED") {
        updateData.archivedAt = new Date();
      }

      if (parsed.data.status === "NEW") {
        updateData.readAt = null;
        updateData.repliedAt = null;
        updateData.archivedAt = null;
      }
    }

    if (adminNote !== undefined && adminNote !== existingInquiry.adminNote) {
      updateData.adminNote = adminNote;
    }

    if (Object.keys(updateData).length === 0) {
      return activityResponse({ message: "No changes to save", inquiry: existingInquiry });
    }

    const inquiry = await tx.hotelInquiry.update({
      where: {
        id: inquiryId,
        hotelId,
      },
      data: updateData,
      select: adminInquirySelect,
    });

    await createAuditLog({
      hotelId,
      actorUserId: access.user.id,
      action: "INQUIRY_UPDATED",
      entityType: "HotelInquiry",
      entityId: inquiry.id,
      summary: `Inquiry "${inquiry.subject}" was updated`,
      metadata: {
        previousStatus: existingInquiry.status,
        nextStatus: inquiry.status,
        adminNoteChanged: existingInquiry.adminNote !== inquiry.adminNote,
      },
    }, tx);

    return activityResponse({
      message: "Inquiry updated",
      inquiry,
    });
  });
}

export async function createPublicHotelInquiry(
  database: PrismaClient,
  slug: string,
  readBody: () => Promise<unknown>,
): Promise<ActivityResult> {
  const body = await readBody().catch(() => null);
  const parsed = publicHotelInquiryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return activityResponse(
      {
        error: parsed.error.issues[0]?.message || "Invalid contact request",
      },
      {
        status: 400,
      },
    );
  }

  const hotel = await database.hotel.findFirst({
    where: {
      slug,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!hotel) {
    return activityResponse(
      { error: "Hotel not found" },
      {
        status: 404,
      },
    );
  }

  const inquiry = await database.hotelInquiry.create({
    data: {
      hotelId: hotel.id,
      guestName: parsed.data.guestName,
      guestEmail: parsed.data.guestEmail,
      guestPhone: parsed.data.guestPhone,
      inquiryType: parsed.data.inquiryType,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
    select: {
      id: true,
      hotelId: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      inquiryType: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
    },
  });

  return activityResponse(
    {
      message: "Contact message sent",
      inquiry,
    },
    {
      status: 201,
    },
  );
}
