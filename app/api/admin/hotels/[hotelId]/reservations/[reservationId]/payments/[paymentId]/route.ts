import { NextResponse } from "next/server";
import { updateAdminPaymentStatus } from "@/apps/api/src/admin-reservations/payment-writes";
import { readAdminReservationPayment } from "@/apps/api/src/admin-reservations/reservation-reads";
import { handleAdminReservationWrite, proxyAdminReservationRead } from "@/lib/adminReservationReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      hotelId: string;
      reservationId: string;
      paymentId: string;
    }>;
  },
) {
  const { hotelId, reservationId, paymentId } = await params;
  const proxied = await proxyAdminReservationRead(request, hotelId, reservationId, "payments", paymentId);
  if (proxied) return proxied;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await readAdminReservationPayment(prisma, hotelId, reservationId, paymentId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string; paymentId: string }> },
) {
  const { hotelId, reservationId, paymentId } = await params;
  return handleAdminReservationWrite(request, hotelId, [reservationId, "payments", paymentId], (user) =>
    updateAdminPaymentStatus(prisma, user, hotelId, reservationId, paymentId, () => request.json()),
  );
}
