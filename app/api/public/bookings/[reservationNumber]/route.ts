import { NextResponse } from "next/server";
import { publicBookingReservationParamSchema } from "@/apps/api/src/booking-domain/public-payment-schema";
import { bookingDetailsRateLimit, readBookingDetails } from "@/apps/api/src/public-bookings/booking-details";
import { getCurrentAuthUser } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";
import { isNestApiProxyConfigured, proxyNestRequest } from "@/lib/nestApiProxy";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reservationNumber: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  const parsed = publicBookingReservationParamSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reservation number", details: parsed.error.flatten() },
      { status: 400, headers },
    );
  }

  const { reservationNumber } = parsed.data;
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    const proxied = await proxyNestRequest(request, `/public/bookings/${encodeURIComponent(reservationNumber)}`, {
      sessionToken: sessionToken ?? undefined,
      rejectRedirects: true,
      unavailableError: "Booking details are unavailable. Please try again.",
    });
    if (proxied) return proxied;
  }

  const limiter = await rateLimit(bookingDetailsRateLimit(getClientIp(request)));
  const responseHeaders = { ...headers, ...rateLimitHeaders(limiter) };
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Too many booking detail requests. Please try again later." },
      { status: 429, headers: { ...responseHeaders, "Retry-After": String(limiter.retryAfterSeconds) } },
    );
  }

  const user = await getCurrentAuthUser();
  const email = new URL(request.url).searchParams.get("guestEmail");
  const result = await readBookingDetails(prisma, reservationNumber, user?.id, email);
  return NextResponse.json(result.body, { status: result.status, headers: responseHeaders });
}
