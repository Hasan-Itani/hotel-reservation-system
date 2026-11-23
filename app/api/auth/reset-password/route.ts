import { proxyNestRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return proxyNestRequest(request, "/guest/reset-password", { json: true });
}
