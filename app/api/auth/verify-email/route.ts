import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/auditLog";
import { getClientIp } from "@/lib/getClientIp";
import { hashEmailVerificationToken } from "@/lib/emailVerification";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { verifyEmailSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limiter = await rateLimit({
    key: `verify-email:${ip}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!limiter.ok) {
    return NextResponse.json(
      {
        error: "Too many verification attempts. Please try again later.",
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

  const parsed = verifyEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid verification link" },
      { status: 400, headers: rateLimitHeaders(limiter) },
    );
  }

  const tokenHash = hashEmailVerificationToken(parsed.data.token);

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          status: true,
          deletedAt: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= new Date() ||
    verificationToken.user.deletedAt ||
    verificationToken.user.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      {
        error:
          "This email verification link is invalid or expired. Request a new verification email.",
      },
      { status: 400, headers: rateLimitHeaders(limiter) },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: verificationToken.user.id,
      },
      data: {
        emailVerifiedAt: verificationToken.user.emailVerifiedAt ?? new Date(),
      },
    });

    await tx.emailVerificationToken.updateMany({
      where: {
        userId: verificationToken.user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await createAuditLog(
      {
        actorUserId: verificationToken.user.id,
        action: "EMAIL_VERIFIED",
        entityType: "User",
        entityId: verificationToken.user.id,
        summary: "Email address was verified",
      },
      tx,
    );
  });

  return NextResponse.json(
    {
      message: "Email verified. You can now sign in.",
    },
    {
      headers: rateLimitHeaders(limiter),
    },
  );
}
