import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; inquiryId: string }> },
) {
  const { hotelId, inquiryId } = await params;
  return proxyNestSessionRequest(request, `/admin/hotels/${encodeURIComponent(hotelId)}/inquiries/${encodeURIComponent(inquiryId)}`, { json: true });
}
