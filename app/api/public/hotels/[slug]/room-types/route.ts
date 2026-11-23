import { proxyNestRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return proxyNestRequest(request, `/public/hotels/${encodeURIComponent(slug)}/room-types`);
}
