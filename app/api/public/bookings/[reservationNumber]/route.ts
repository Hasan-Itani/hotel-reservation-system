import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reservationNumber: string }> },
) {
  const { reservationNumber } = await params;
  return proxyNestSessionRequest(request, `/public/bookings/${encodeURIComponent(reservationNumber)}`);
}
