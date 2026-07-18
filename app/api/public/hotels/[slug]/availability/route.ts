import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getRoomTypeAvailabilityForHotel } from "@/lib/reservationAvailability";
import { availabilityQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `public-availability:${ip}:${slug}`,
    windowMs: 5 * 60 * 1000,
    maxRequests: 60,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many availability requests. Please try again later.",
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

  const hotel = await prisma.hotel.findFirst({
    where: {
      slug,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      currency: true,
    },
  });

  if (!hotel) {
    return NextResponse.json(
      { error: "Hotel not found" },
      {
        status: 404,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const url = new URL(request.url);

  const parsed = availabilityQuerySchema.safeParse({
    checkInDate: url.searchParams.get("checkInDate"),
    checkOutDate: url.searchParams.get("checkOutDate"),
    adults: url.searchParams.get("adults") ?? undefined,
    children: url.searchParams.get("children") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const { checkInDate, checkOutDate, adults, children } = parsed.data;

  const availability = await getRoomTypeAvailabilityForHotel({
    hotelId: hotel.id,
    checkInDate,
    checkOutDate,
    adults,
    children,
  });

  return NextResponse.json(
    {
      hotel: {
        id: hotel.id,
        name: hotel.name,
        slug: hotel.slug,
        currency: hotel.currency,
      },
      checkInDate,
      checkOutDate,
      roomTypes: availability.availability,
    },
    {
      headers: rateLimitHeaders(limiter),
    },
  );
}