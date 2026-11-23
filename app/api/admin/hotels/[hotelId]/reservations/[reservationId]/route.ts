import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string }> },
) {
  const { hotelId, reservationId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/reservations/${encodeURIComponent(reservationId)}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string }> },
) {
  const { hotelId, reservationId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/reservations/${encodeURIComponent(reservationId)}`, { json: true });
}
