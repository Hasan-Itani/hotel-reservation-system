import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { requireAuth } from "@/lib/guards";
import { canAccessHotel } from "@/lib/permissions";
import { adminHotelInquiryUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      hotelId: string;
      inquiryId: string;
    }>;
  },
) {
  const auth = await requireAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const { hotelId, inquiryId } = await params;

  if (!canAccessHotel(auth.user, hotelId)) {
    return NextResponse.json(
      { error: "You do not have access to this hotel" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = adminHotelInquiryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Invalid inquiry update",
      },
      { status: 400 },
    );
  }

  const existingInquiry = await prisma.hotelInquiry.findFirst({
    where: {
      id: inquiryId,
      hotelId,
    },
    select: {
      id: true,
      status: true,
      adminNote: true,
      subject: true,
    },
  });

  if (!existingInquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const updateData: {
    status?: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
    adminNote?: string | null;
    readAt?: Date | null;
    repliedAt?: Date | null;
    archivedAt?: Date | null;
  } = {};

  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;

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

  if (parsed.data.adminNote !== undefined) {
    updateData.adminNote = parsed.data.adminNote;
  }

  const inquiry = await prisma.hotelInquiry.update({
    where: {
      id: inquiryId,
    },
    data: updateData,
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
    },
  });

  await createAuditLog({
    hotelId,
    actorUserId: auth.user.id,
    action: "INQUIRY_UPDATED",
    entityType: "HotelInquiry",
    entityId: inquiry.id,
    summary: `Inquiry "${inquiry.subject}" was updated`,
    metadata: {
      previousStatus: existingInquiry.status,
      nextStatus: inquiry.status,
      adminNoteChanged: existingInquiry.adminNote !== inquiry.adminNote,
    },
  });

  return NextResponse.json({
    message: "Inquiry updated",
    inquiry,
  });
}
