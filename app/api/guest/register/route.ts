import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  createEmailVerificationToken,
  getEmailVerificationExpiry,
  hashEmailVerificationToken,
} from "@/lib/emailVerification";
import { sendEmailVerificationEmail } from "@/lib/email";
import { getClientIp } from "@/lib/getClientIp";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { guestRegisterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function canExposeDevelopmentVerificationLink() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.SHOW_DEV_VERIFICATION_LINK !== "false"
  );
}

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

  const verificationToken = createEmailVerificationToken();
  const verificationTokenHash = hashEmailVerificationToken(verificationToken);

  await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerificationTokens: {
        create: {
          tokenHash: verificationTokenHash,
          expiresAt: getEmailVerificationExpiry(),
        },
      },
    },
  });

  const verificationUrl = `${new URL(request.url).origin}/guest/verify-email?token=${encodeURIComponent(verificationToken)}`;

  try {
    const emailResult = await sendEmailVerificationEmail({
      to: email,
      verificationUrl,
    });

    if (!emailResult.sent && process.env.NODE_ENV === "production") {
      console.error(
        "Email verification is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
      );
    }
  } catch (error) {
    console.error("Email verification failed", error);
  }

  return NextResponse.json(
    {
      message:
        "Account created. Check your email and verify your address before signing in.",
      ...(canExposeDevelopmentVerificationLink() ? { verificationUrl } : {}),
    },
    {
      status: 201,
      headers: rateLimitHeaders(limiter),
    },
  );
}
