export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const trueClientIp = request.headers.get("true-client-ip");
  const xClientIp = request.headers.get("x-client-ip");

  const rawIp =
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    cfConnectingIp?.trim() ||
    trueClientIp?.trim() ||
    xClientIp?.trim() ||
    "unknown";

  if (rawIp === "::1") {
    return "127.0.0.1";
  }

  if (rawIp.startsWith("::ffff:")) {
    return rawIp.replace("::ffff:", "");
  }

  return rawIp;
}
