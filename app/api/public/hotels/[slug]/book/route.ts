import { NextResponse } from "next/server";
import { createPublicReservation } from "@/apps/api/src/booking-domain/create-public-reservation";
import { getCurrentAuthUser } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";
import { isNestApiProxyConfigured, proxyNestJsonRequest } from "@/lib/nestApiProxy";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getSessionToken } from "@/lib/session";
import { publicReservationCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    const response = await proxyNestJsonRequest(
      request,
      `/public/hotels/${encodeURIComponent(slug)}/book`,
      { sessionToken: sessionToken ?? undefined },
    );
    if (response) {
      return response;
    }
  }

  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `public-booking-create:${ip}:${slug}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
  });

  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "You must sign in before booking.",
      },
      {
        status: 401,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many booking attempts. Please try again later.",
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

  const parsed = publicReservationCreateSchema.safeParse(body);

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

  const result = await createPublicReservation(prisma, slug, user, parsed.data);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: rateLimitHeaders(limiter),
  });
}
