import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestRequest } from "@/lib/nestApiProxy";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/session";
import {
  publicBookingSelect,
  serializePublicBooking,
} from "@/lib/publicBookingSerializer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const response = await proxyNestRequest(request, "/guest/bookings", { sessionToken });
    if (response) {
      response.headers.set("Cache-Control", headers["Cache-Control"]);
      return response;
    }
  }

  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers },
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

  return NextResponse.json(
    { bookings: bookings.map((booking) => serializePublicBooking(booking)) },
    { headers },
  );
}
