import { proxyNestRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return proxyNestRequest(request, "/guest/forgot-password", { json: true });
}
