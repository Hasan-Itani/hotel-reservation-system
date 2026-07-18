import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";
import { prisma } from "@/lib/prisma";
import {
  publicBookingSelect,
  serializePublicBooking,
} from "@/lib/publicBookingSerializer";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  publicBookingAccessQuerySchema,
  publicBookingReservationParamSchema,
} from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ reservationNumber: string }> },
) {
  const routeParams = await context.params;

  const parsedParams =
    publicBookingReservationParamSchema.safeParse(routeParams);

  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid reservation number",
        details: parsedParams.error.flatten(),
      },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `booking-details:${ip}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 10,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many booking detail requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limiter.retryAfterSeconds),
          ...rateLimitHeaders(limiter),
        },
      },
    );
  }

  const currentUser = await getCurrentAuthUser();
  const url = new URL(request.url);
  const rawGuestEmail = url.searchParams.get("guestEmail");

  let guestEmail: string | null = null;

  if (rawGuestEmail) {
    const parsedQuery = publicBookingAccessQuerySchema.safeParse({
      guestEmail: rawGuestEmail,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid guest email",
          details: parsedQuery.error.flatten(),
        },
        {
          status: 400,
          headers: rateLimitHeaders(limiter),
        },
      );
    }

    guestEmail = parsedQuery.data.guestEmail;
  }

  if (!currentUser && !guestEmail) {
    return NextResponse.json(
      {
        error: "guestEmail is required unless you are signed in",
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const { reservationNumber } = parsedParams.data;

  const accessFilters = [
    ...(currentUser ? [{ userId: currentUser.id }] : []),
    ...(guestEmail ? [{ guestEmail }] : []),
  ];

  try {
    const reservation = await prisma.reservation.findFirst({
      where: {
        reservationNumber,
        hotel: {
          deletedAt: null,
        },
        OR: accessFilters,
      },
      select: publicBookingSelect,
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Booking not found" },
        {
          status: 404,
          headers: rateLimitHeaders(limiter),
        },
      );
    }

    return NextResponse.json(
      {
        booking: serializePublicBooking(reservation),
      },
      {
        status: 200,
        headers: rateLimitHeaders(limiter),
      },
    );
  } catch (error) {
    console.error("Public booking details error:", error);

    return NextResponse.json(
      { error: "Failed to fetch booking" },
      {
        status: 500,
        headers: rateLimitHeaders(limiter),
      },
    );
  }
}