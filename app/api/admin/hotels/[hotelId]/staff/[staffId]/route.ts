import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; staffId: string }> },
) {
  const { hotelId, staffId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/staff/${encodeURIComponent(staffId)}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; staffId: string }> },
) {
  const { hotelId, staffId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/staff/${encodeURIComponent(staffId)}`, { json: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; staffId: string }> },
) {
  const { hotelId, staffId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/staff/${encodeURIComponent(staffId)}`);
}
