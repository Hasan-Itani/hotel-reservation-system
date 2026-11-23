import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { proxyNestGet, proxyNestJsonRequest } from "@/lib/nestApiProxy";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { createPublicHotelInquiry } from "@/apps/api/src/inquiries/inquiry-actions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const proxiedResponse = await proxyNestGet(
    request,
    `/public/hotels/${encodeURIComponent(slug)}`,
  );

  if (proxiedResponse) {
    return proxiedResponse;
  }

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
  const proxied = await proxyNestJsonRequest(request, `/public/hotels/${encodeURIComponent(slug)}`, {
    rejectRedirects: true,
    unavailableError: "Contact service is unavailable. Please try again.",
  });
  if (proxied) return proxied;

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

  const result = await createPublicHotelInquiry(prisma, slug, () => request.json());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store", ...rateLimitHeaders(limiter) },
  });
}
