import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { getClientIp } from "@/lib/getClientIp";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limiter = rateLimit({
    key: `login:${ip}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limiter.retryAfterSeconds),
          "X-RateLimit-Limit": String(limiter.limit),
          "X-RateLimit-Remaining": String(limiter.remaining),
          "X-RateLimit-Reset": String(limiter.resetAt),
        },
      }
    );
  }

  try {
    const body = await request.json();

    const result = await authenticateUser(body);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        {
          status: result.status,
          headers: {
            "X-RateLimit-Limit": String(limiter.limit),
            "X-RateLimit-Remaining": String(limiter.remaining),
            "X-RateLimit-Reset": String(limiter.resetAt),
          },
        }
      );
    }

    await setSessionCookie(result.token);

    return NextResponse.json(
      {
        message: "Login successful",
        user: result.user,
      },
      {
        headers: {
          "X-RateLimit-Limit": String(limiter.limit),
          "X-RateLimit-Remaining": String(limiter.remaining),
          "X-RateLimit-Reset": String(limiter.resetAt),
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during login" },
      {
        status: 500,
        headers: {
          "X-RateLimit-Limit": String(limiter.limit),
          "X-RateLimit-Remaining": String(limiter.remaining),
          "X-RateLimit-Reset": String(limiter.resetAt),
        },
      }
    );
  }
}