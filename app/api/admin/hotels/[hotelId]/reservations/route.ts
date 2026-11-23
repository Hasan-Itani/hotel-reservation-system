import { NextResponse } from "next/server";
import { listAdminReservations } from "@/apps/api/src/admin-reservations/reservation-reads";
import { createAdminReservation } from "@/apps/api/src/admin-reservations/reservation-writes";
import { handleAdminReservationWrite, proxyAdminReservationRead } from "@/lib/adminReservationReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> }
) {
  const { hotelId } = await params;
  const proxied = await proxyAdminReservationRead(request, hotelId);
  if (proxied) return proxied;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await listAdminReservations(prisma, hotelId, new URL(request.url).searchParams);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return handleAdminReservationWrite(request, hotelId, [], (user) =>
    createAdminReservation(prisma, user, hotelId, () => request.json()),
  );
}
