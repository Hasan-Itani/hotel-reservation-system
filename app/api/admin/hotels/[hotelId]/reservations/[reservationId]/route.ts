import { NextResponse } from "next/server";
import { readAdminReservation } from "@/apps/api/src/admin-reservations/reservation-reads";
import { updateAdminReservation } from "@/apps/api/src/admin-reservations/reservation-writes";
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
  const proxied = await proxyAdminReservationRead(request, hotelId, reservationId);
  if (proxied) return proxied;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await readAdminReservation(prisma, hotelId, reservationId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string }> },
) {
  const { hotelId, reservationId } = await params;
  return handleAdminReservationWrite(request, hotelId, [reservationId], (user) =>
    updateAdminReservation(prisma, user, hotelId, reservationId, () => request.json()),
  );
}
