import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string }> },
) {
  const { hotelId, reservationId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/reservations/${encodeURIComponent(reservationId)}/payments`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; reservationId: string }> },
) {
  const { hotelId, reservationId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/reservations/${encodeURIComponent(reservationId)}/payments`, { json: true });
}
