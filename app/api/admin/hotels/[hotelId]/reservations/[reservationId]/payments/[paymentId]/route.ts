import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string; paymentId: string }> },
) {
  const { hotelId, reservationId, paymentId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/reservations/${encodeURIComponent(reservationId)}/payments/${encodeURIComponent(paymentId)}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string; paymentId: string }> },
) {
  const { hotelId, reservationId, paymentId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/reservations/${encodeURIComponent(reservationId)}/payments/${encodeURIComponent(paymentId)}`, { json: true });
}
