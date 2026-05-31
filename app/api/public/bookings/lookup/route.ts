import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/getClientIp";
import { prisma } from "@/lib/prisma";
import {
  publicBookingSelect,
  serializePublicBooking,
} from "@/lib/publicBookingSerializer";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { publicBookingLookupSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limiter = rateLimit({
    key: `booking-lookup:${ip}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 10,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many booking lookup attempts. Please try again later.",
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const parsedBody = publicBookingLookupSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid lookup data",
        details: parsedBody.error.flatten(),
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const { reservationNumber, guestEmail } = parsedBody.data;

  try {
    const reservation = await prisma.reservation.findFirst({
      where: {
        reservationNumber,
        guestEmail,
        hotel: {
          deletedAt: null,
        },
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
        message: "Booking found",
        booking: serializePublicBooking(reservation),
      },
      {
        status: 200,
        headers: rateLimitHeaders(limiter),
      },
    );
  } catch (error) {
    console.error("Public booking lookup error:", error);

    return NextResponse.json(
      { error: "Failed to look up booking" },
      {
        status: 500,
        headers: rateLimitHeaders(limiter),
      },
    );
  }
}