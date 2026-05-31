import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { hasGlobalRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const user = auth.user;

  if (hasGlobalRole(user, "SUPER_ADMIN")) {
    const hotels = await prisma.hotel.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        country: true,
        timezone: true,
        currency: true,
        starRating: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ hotels });
  }

  const hotelIds = [...new Set(user.hotelRoles.map((item) => item.hotelId))];

  const hotels = await prisma.hotel.findMany({
    where: {
      id: { in: hotelIds },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      country: true,
      timezone: true,
      currency: true,
      starRating: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ hotels });
}