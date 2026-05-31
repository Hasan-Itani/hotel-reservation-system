import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  publicBookingSelect,
  serializePublicBooking,
} from "@/lib/publicBookingSerializer";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const bookings = await prisma.reservation.findMany({
    where: {
      userId: user.id,
      hotel: {
        deletedAt: null,
      },
    },
    select: publicBookingSelect,
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    bookings: bookings.map((booking) => serializePublicBooking(booking)),
  });
}