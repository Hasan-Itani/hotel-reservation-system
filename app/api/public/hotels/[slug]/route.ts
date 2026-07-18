import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { publicHotelInquiryCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `public-hotel-detail:${ip}:${slug}`,
    windowMs: 5 * 60 * 1000,
    maxRequests: 120,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
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
      description: true,
      email: true,
      phone: true,
      country: true,
      city: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      starRating: true,
      checkInTime: true,
      checkOutTime: true,
      currency: true,
      timezone: true,
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

  return NextResponse.json(
    { hotel },
    {
      headers: rateLimitHeaders(limiter),
    },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `public-hotel-contact:${ip}:${slug}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 10,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many contact requests. Please try again later.",
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

  const body = await request.json().catch(() => null);
  const parsed = publicHotelInquiryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Invalid contact request",
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
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

  const inquiry = await prisma.hotelInquiry.create({
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

  return NextResponse.json(
    {
      message: "Contact message sent",
      inquiry,
    },
    {
      status: 201,
      headers: rateLimitHeaders(limiter),
    },
  );
}