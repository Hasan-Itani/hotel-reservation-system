import { proxyNestSessionRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return proxyNestSessionRequest(request, "/admin/hotels");
}
