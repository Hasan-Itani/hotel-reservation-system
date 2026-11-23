import { proxyNestRequest } from "@/lib/nestApiProxy";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return proxyNestRequest(request, "/public/bookings/lookup", { json: true });
}
