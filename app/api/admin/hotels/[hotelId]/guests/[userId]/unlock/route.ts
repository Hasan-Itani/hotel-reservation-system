import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; userId: string }> },
) {
  const { hotelId, userId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/guests/${encodeURIComponent(userId)}/unlock`);
}
