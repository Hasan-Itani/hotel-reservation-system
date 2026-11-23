import { proxyNestRequest } from "@/lib/nestApiProxy";
import { setSessionCookie } from "@/lib/session";

export function POST(request: Request) {
  return proxyNestRequest(request, "/auth/login", { json: true, receiveSession: setSessionCookie });
}
