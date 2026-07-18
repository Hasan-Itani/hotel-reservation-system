import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/auditLog";
import { getClientIp } from "@/lib/getClientIp";
import { hashPasswordResetToken } from "@/lib/passwordReset";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { resetPasswordSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limiter = rateLimit({
    key: `reset-password:${ip}`,
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
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

  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid password reset request",
        details: parsed.error.flatten(),
      },
      { status: 400, headers: rateLimitHeaders(limiter) },
    );
  }

  const tokenHash = hashPasswordResetToken(parsed.data.token);

  const resetToken = await prisma.passwordResetToken.findUnique({
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
        },
      },
    },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= new Date() ||
    resetToken.user.deletedAt ||
    resetToken.user.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      {
        error:
          "This password reset link is invalid or expired. Request a new reset link.",
      },
      { status: 400, headers: rateLimitHeaders(limiter) },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: resetToken.user.id,
      },
      data: {
        passwordHash,
        sessionVersion: {
          increment: 1,
        },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await createAuditLog(
      {
        actorUserId: resetToken.user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: resetToken.user.id,
        summary: "Password was changed using a reset link",
      },
      tx,
    );
  });

  return NextResponse.json(
    {
      message: "Password updated successfully. You can now sign in.",
    },
    {
      headers: rateLimitHeaders(limiter),
    },
  );
}
