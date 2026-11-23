import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reservationNumber: string }> },
) {
  const { reservationNumber } = await params;
  return proxyNestSessionRequest(request, `/public/bookings/${encodeURIComponent(reservationNumber)}/pay`, { json: true });
}
