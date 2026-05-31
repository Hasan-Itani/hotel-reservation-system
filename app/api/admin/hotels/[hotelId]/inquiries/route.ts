import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { canAccessHotel } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const auth = await requireAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const { hotelId } = await params;

  if (!canAccessHotel(auth.user, hotelId)) {
    return NextResponse.json(
      { error: "You do not have access to this hotel" },
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
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const inquiries = await prisma.hotelInquiry.findMany({
    where: {
      hotelId,
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
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    hotelId,
    inquiries,
  });
}