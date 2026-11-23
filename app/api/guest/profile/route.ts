import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export function PUT(request: Request) {
  return proxyNestSessionRequest(request, "/guest/profile", { json: true });
}
