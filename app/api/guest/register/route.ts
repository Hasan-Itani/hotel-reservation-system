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

const VERIFICATION_ALREADY_SENT_RESPONSE =
  "A verification email was already sent. Check your inbox before requesting another one.";

async function sendVerificationEmail(input: {
  email: string;
  origin: string;
  userId: string;
}) {
  const verificationToken = createEmailVerificationToken();
  const verificationTokenHash = hashEmailVerificationToken(verificationToken);

  await prisma.emailVerificationToken.create({
    data: {
      userId: input.userId,
      tokenHash: verificationTokenHash,
      expiresAt: getEmailVerificationExpiry(),
    },
  });

  const verificationUrl = `${input.origin}/guest/verify-email?token=${encodeURIComponent(verificationToken)}`;

  try {
    const emailResult = await sendEmailVerificationEmail({
      to: input.email,
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
      emailVerifiedAt: true,
      status: true,
    },
  });

  if (existingUser && !existingUser.deletedAt) {
    if (!existingUser.emailVerifiedAt && existingUser.status === "ACTIVE") {
      const existingActiveToken =
        await prisma.emailVerificationToken.findFirst({
          where: {
            userId: existingUser.id,
            usedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          select: {
            id: true,
          },
        });

      if (existingActiveToken) {
        return NextResponse.json(
          {
            message: VERIFICATION_ALREADY_SENT_RESPONSE,
          },
          {
            status: 200,
            headers: rateLimitHeaders(limiter),
          },
        );
      }

      await sendVerificationEmail({
        email,
        origin: new URL(request.url).origin,
        userId: existingUser.id,
      });

      return NextResponse.json(
        {
          message:
            "Verification email sent. Check your inbox before signing in.",
        },
        {
          status: 200,
          headers: rateLimitHeaders(limiter),
        },
      );
    }

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
    },
    select: {
      id: true,
    },
  });

  await sendVerificationEmail({
    email,
    origin: new URL(request.url).origin,
    userId: user.id,
  });

  return NextResponse.json(
    {
      message:
        "Account created. Check your email and verify your address before signing in.",
    },
    {
      status: 201,
      headers: rateLimitHeaders(limiter),
    },
  );
}
