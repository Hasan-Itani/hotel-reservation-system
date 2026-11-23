import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return proxyNestSessionRequest(request, `/public/hotels/${encodeURIComponent(slug)}/book`, { json: true });
}
