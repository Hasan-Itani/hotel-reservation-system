import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomTypeId: string }> },
) {
  const { hotelId, roomTypeId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/room-types/${encodeURIComponent(roomTypeId)}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomTypeId: string }> },
) {
  const { hotelId, roomTypeId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/room-types/${encodeURIComponent(roomTypeId)}`, { json: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomTypeId: string }> },
) {
  const { hotelId, roomTypeId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/room-types/${encodeURIComponent(roomTypeId)}`);
}
