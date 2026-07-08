import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";
import { getClientIp } from "@/lib/getClientIp";
import {
  createPasswordResetToken,
  getPasswordResetExpiry,
  hashPasswordResetToken,
} from "@/lib/passwordReset";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { forgotPasswordSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const PASSWORD_RESET_RESPONSE =
  "If an active account exists for that email, password reset instructions have been sent.";
const PASSWORD_RESET_ALREADY_SENT_RESPONSE =
  "A password reset email was already sent recently. Check your inbox before requesting another one.";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limiter = rateLimit({
    key: `forgot-password:${ip}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many password reset attempts. Please try again later.",
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
      { status: 400, headers: rateLimitHeaders(limiter) },
    );
  }

  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Enter a valid email address",
        details: parsed.error.flatten(),
      },
      { status: 400, headers: rateLimitHeaders(limiter) },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: parsed.data.email,
    },
    select: {
      id: true,
      status: true,
      deletedAt: true,
    },
  });

  if (user && !user.deletedAt && user.status === "ACTIVE") {
    const existingActiveToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
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
          message: PASSWORD_RESET_ALREADY_SENT_RESPONSE,
        },
        {
          headers: rateLimitHeaders(limiter),
        },
      );
    }

    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: getPasswordResetExpiry(),
        },
      });
    });

    const resetUrl = `${new URL(request.url).origin}/guest/reset-password?token=${encodeURIComponent(token)}`;

    try {
      const emailResult = await sendPasswordResetEmail({
        to: parsed.data.email,
        resetUrl,
      });

      if (!emailResult.sent && process.env.NODE_ENV === "production") {
        console.error(
          "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
        );
      }
    } catch (error) {
      console.error("Password reset email failed", error);
    }
  }

  return NextResponse.json(
    {
      message: PASSWORD_RESET_RESPONSE,
    },
    {
      headers: rateLimitHeaders(limiter),
    },
  );
}
