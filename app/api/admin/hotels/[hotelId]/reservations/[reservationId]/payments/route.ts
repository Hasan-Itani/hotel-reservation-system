import { NextResponse } from "next/server";
import { createAdminMockPayment } from "@/apps/api/src/admin-reservations/payment-writes";
import { listAdminReservationPayments } from "@/apps/api/src/admin-reservations/reservation-reads";
import { handleAdminReservationWrite, proxyAdminReservationRead } from "@/lib/adminReservationReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; reservationId: string }>;
  },
) {
  const { hotelId, reservationId } = await params;
  const proxied = await proxyAdminReservationRead(request, hotelId, reservationId, "payments");
  if (proxied) return proxied;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await listAdminReservationPayments(prisma, hotelId, reservationId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string }> },
) {
  const { hotelId, reservationId } = await params;
  return handleAdminReservationWrite(request, hotelId, [reservationId, "payments"], (user) =>
    createAdminMockPayment(prisma, user, hotelId, reservationId, () => request.json()),
  );
}
