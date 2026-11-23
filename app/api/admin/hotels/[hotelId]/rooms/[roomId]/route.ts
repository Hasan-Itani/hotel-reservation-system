import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomId: string }> },
) {
  const { hotelId, roomId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/rooms/${encodeURIComponent(roomId)}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomId: string }> },
) {
  const { hotelId, roomId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/rooms/${encodeURIComponent(roomId)}`, { json: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomId: string }> },
) {
  const { hotelId, roomId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/rooms/${encodeURIComponent(roomId)}`);
}
