import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { getClientIp } from "@/lib/getClientIp";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  const emailKey = parsed.success ? parsed.data.email : "invalid";

  const accountLimiter = await rateLimit({
    key: `login-account:${emailKey}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!accountLimiter.ok) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(accountLimiter.retryAfterSeconds),
          ...rateLimitHeaders(accountLimiter),
        },
      },
    );
  }

  const ipLimiter = await rateLimit({
    key: `login-ip:${ip}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 50,
  });

  if (!ipLimiter.ok) {
    return NextResponse.json(
      {
        error: "Too many login attempts from this network. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimiter.retryAfterSeconds),
          ...rateLimitHeaders(ipLimiter),
        },
      },
    );
  }

  try {
    const result = await authenticateUser(parsed.success ? parsed.data : body);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        {
          status: result.status,
          headers: rateLimitHeaders(accountLimiter),
        },
      );
    }

    await setSessionCookie(result.token);

    return NextResponse.json(
      {
        message: "Login successful",
        user: result.user,
      },
      {
        headers: rateLimitHeaders(accountLimiter),
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during login" },
      {
        status: 500,
        headers: rateLimitHeaders(accountLimiter),
      },
    );
  }
}
