import { NextResponse } from "next/server";
import { submitPublicPayment } from "@/apps/api/src/booking-domain/submit-public-payment";
import { getCurrentAuthUser } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";
import { isNestApiProxyConfigured, proxyNestJsonRequest } from "@/lib/nestApiProxy";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getSessionToken } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reservationNumber: string }> },
) {
  const { reservationNumber } = await params;
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    const response = await proxyNestJsonRequest(
      request,
      `/public/bookings/${encodeURIComponent(reservationNumber)}/pay`,
      {
        sessionToken: sessionToken ?? undefined,
        rejectRedirects: true,
        unavailableError: "Payment service is unavailable. Check your booking balance before trying again.",
      },
    );
    if (response) {
      return response;
    }
  }

  const limiter = await rateLimit({
    key: `booking-pay:${getClientIp(request)}`,
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
  });
  const headers = { "Cache-Control": "private, no-store", ...rateLimitHeaders(limiter) };
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds), ...headers } },
    );
  }

  const body = await request.json().catch(() => null);
  const result = await submitPublicPayment(prisma, reservationNumber, body, getCurrentAuthUser);
  return NextResponse.json(result.body, { status: result.status, headers });
}
