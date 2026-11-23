import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/rooms`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/rooms`, { json: true });
}
