import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/getClientIp";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { setSessionCookie, signSession } from "@/lib/session";
import { guestRegisterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limiter = rateLimit({
    key: `guest-register:${ip}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many registration attempts. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limiter.retryAfterSeconds),
          ...rateLimitHeaders(limiter),
        },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const parsed = guestRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid registration data",
        details: parsed.error.flatten(),
      },
      {
        status: 400,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const { firstName, lastName, email, phone, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (existingUser && !existingUser.deletedAt) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      {
        status: 409,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  if (existingUser?.deletedAt) {
    return NextResponse.json(
      { error: "This email cannot be used" },
      {
        status: 409,
        headers: rateLimitHeaders(limiter),
      },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    },
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
  });

  await setSessionCookie(token);

  return NextResponse.json(
    {
      message: "Guest account created",
      user: {
        ...user,
        globalRoles: [],
        hotelRoles: [],
      },
    },
    {
      status: 201,
      headers: rateLimitHeaders(limiter),
    },
  );
}