import { proxyNestRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return proxyNestRequest(request, "/public/hotels");
}
