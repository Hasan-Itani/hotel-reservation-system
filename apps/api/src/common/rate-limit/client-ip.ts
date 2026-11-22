import type { FastifyRequest } from "fastify";

export function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getClientIp(request: FastifyRequest) {
  const forwardedFor = getHeaderValue(request.headers["x-forwarded-for"]);
  const rawIp =
    forwardedFor?.split(",")[0]?.trim() ||
    getHeaderValue(request.headers["x-real-ip"]) ||
    getHeaderValue(request.headers["cf-connecting-ip"]) ||
    getHeaderValue(request.headers["true-client-ip"]) ||
    getHeaderValue(request.headers["x-client-ip"]) ||
    request.ip ||
    "unknown";

  if (rawIp === "::1") {
    return "127.0.0.1";
  }

  return rawIp.startsWith("::ffff:") ? rawIp.replace("::ffff:", "") : rawIp;
}
