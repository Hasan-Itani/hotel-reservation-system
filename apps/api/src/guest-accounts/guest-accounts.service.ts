import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { PrismaService } from "../database/prisma.service";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

class UnavailableVerificationTokenError extends Error {}
class UnavailablePasswordResetTokenError extends Error {}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const VERIFICATION_ALREADY_SENT_RESPONSE =
  "A verification email was already sent. Check your inbox before requesting another one.";
export const VERIFICATION_SEND_FAILED_RESPONSE =
  "We could not send the verification email right now. Please try again later.";

type RegisterGuestInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
};

@Injectable()
export class GuestAccountsService {
  private readonly logger = new Logger(GuestAccountsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async updateProfile(
    userId: string,
    sessionVersion: number,
    profile: { firstName: string; lastName: string; phone: string | null },
  ) {
    const [user] = await this.prisma.user.updateManyAndReturn({
      where: { id: userId, sessionVersion, status: "ACTIVE", deletedAt: null },
      data: profile,
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    return user ?? null;
  }

  async register(input: RegisterGuestInput, origin: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: input.email,
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
          await this.prisma.emailVerificationToken.findFirst({
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
          return { type: "already-sent" as const };
        }

        const sent = await this.sendVerificationEmail({
          email: input.email,
          origin,
          userId: existingUser.id,
        });

        return { type: sent ? ("resent" as const) : ("send-failed" as const) };
      }

      return { type: "already-exists" as const };
    }

    if (existingUser?.deletedAt) {
      return { type: "unusable-email" as const };
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        passwordHash,
        status: "ACTIVE",
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
      },
    });

    await this.createAuditLog({
      actorUserId: user.id,
      action: "GUEST_REGISTERED",
      entityType: "User",
      entityId: user.id,
      summary: `${input.firstName} ${input.lastName} created a guest account`,
      metadata: {
        email: input.email,
        phone: input.phone,
      },
    });

    const sent = await this.sendVerificationEmail({
      email: input.email,
      origin,
      userId: user.id,
    });

    return { type: sent ? ("created" as const) : ("send-failed" as const) };
  }

  async verifyEmail(token: string): Promise<boolean> {
    const tokenHash = hashToken(token);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const verificationToken = await tx.emailVerificationToken.findUnique({
          where: { tokenHash },
          select: {
            id: true,
            expiresAt: true,
            usedAt: true,
            user: {
              select: {
                id: true,
                emailVerifiedAt: true,
                deletedAt: true,
                status: true,
              },
            },
          },
        });
        const now = new Date();

        if (
          !verificationToken ||
          verificationToken.usedAt ||
          verificationToken.expiresAt <= now ||
          verificationToken.user.deletedAt ||
          verificationToken.user.status !== "ACTIVE"
        ) {
          return false;
        }

        const user = verificationToken.user;
        const updatedUser = await tx.user.updateMany({
          where: { id: user.id, deletedAt: null, status: "ACTIVE" },
          data: { emailVerifiedAt: user.emailVerifiedAt ?? now },
        });

        if (updatedUser.count === 0) {
          return false;
        }

        const consumedAt = new Date();
        const consumedToken = await tx.emailVerificationToken.updateMany({
          where: {
            id: verificationToken.id,
            usedAt: null,
            expiresAt: { gt: consumedAt },
          },
          data: { usedAt: consumedAt },
        });

        if (consumedToken.count === 0) {
          throw new UnavailableVerificationTokenError();
        }

        await tx.emailVerificationToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: consumedAt },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "EMAIL_VERIFIED",
            entityType: "User",
            entityId: user.id,
            summary: "Email address was verified",
          },
        });

        return true;
      });
    } catch (error) {
      if (error instanceof UnavailableVerificationTokenError) {
        return false;
      }

      throw error;
    }
  }

  async requestPasswordReset(email: string) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const request = await this.prisma.$transaction(async (tx) => {
      const [user] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User"
        WHERE "email" = ${email} AND "deletedAt" IS NULL AND "status" = 'ACTIVE'
        FOR UPDATE
      `;

      if (!user) {
        return { type: "accepted" as const };
      }

      const now = new Date();
      const existingToken = await tx.passwordResetToken.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
        select: { id: true },
      });

      if (existingToken) {
        return { type: "already-sent" as const };
      }

      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });

      return { type: "created" as const, userId: user.id };
    });

    if (request.type !== "created") {
      return request.type;
    }

    try {
      const appUrl = this.config.get<string>("NEXT_PUBLIC_APP_URL") ||
        (this.config.get<string>("NODE_ENV") === "production" ? "" : "http://localhost:3000");
      const resetUrl = new URL("/guest/reset-password", appUrl);
      if (resetUrl.protocol !== "https:" && resetUrl.protocol !== "http:") {
        throw new Error("NEXT_PUBLIC_APP_URL must use HTTP or HTTPS");
      }
      resetUrl.searchParams.set("token", token);

      const expiryNotice =
        "This link expires in 60 minutes. If you did not request this, you can ignore this email.";
      const sent = await this.sendEmail({
        to: email,
        subject: "Reset your Hotel System password",
        text: `We received a request to reset your Hotel System password.\n\nOpen this secure link to choose a new password:\n${resetUrl.href}\n\n${expiryNotice}`,
        html: `<p>We received a request to reset your Hotel System password.</p><p><a href="${resetUrl.href}">Reset your password</a></p><p>${expiryNotice}</p>`,
      });

      if (!sent) {
        throw new Error("Password reset email is not configured");
      }
    } catch {
      await this.prisma.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      });
      this.logger.error("Password reset email delivery failed");
      return "send-failed";
    }

    await this.createAuditLog({
      actorUserId: request.userId,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: request.userId,
      summary: "Password reset email was sent",
      metadata: { email },
    });
    return "accepted";
  }

  async resetPassword(token: string, password: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: { id: true, status: true, deletedAt: true, passwordHash: true },
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
      return "invalid";
    }

    const user = resetToken.user;
    if (await bcrypt.compare(password, user.passwordHash)) {
      return "reused-password";
    }

    const passwordHash = await bcrypt.hash(password, 12);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.updateMany({
          where: { id: user.id, status: "ACTIVE", deletedAt: null, passwordHash: user.passwordHash },
          data: {
            passwordHash,
            sessionVersion: { increment: 1 },
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        if (updatedUser.count === 0) {
          return "invalid";
        }

        const usedAt = new Date();
        const consumedToken = await tx.passwordResetToken.updateMany({
          where: { id: resetToken.id, usedAt: null, expiresAt: { gt: usedAt } },
          data: { usedAt },
        });
        if (consumedToken.count === 0) {
          throw new UnavailablePasswordResetTokenError();
        }

        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "PASSWORD_CHANGED",
            entityType: "User",
            entityId: user.id,
            summary: "Password was changed using a reset link",
          },
        });
        return "updated";
      });
    } catch (error) {
      if (error instanceof UnavailablePasswordResetTokenError) {
        return "invalid";
      }
      throw error;
    }
  }

  private async sendVerificationEmail(input: {
    email: string;
    origin: string;
    userId: string;
  }) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
      },
    });

    try {
      const verificationUrl = `${input.origin}/guest/verify-email?token=${encodeURIComponent(token)}`;
      const sent = await this.sendEmail({
        to: input.email,
        subject: "Verify your Hotel System email",
        text: [
          "Welcome to Hotel System.",
          "",
          "Open this secure link to verify your email address:",
          verificationUrl,
          "",
          "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
        ].join("\n"),
        html: [
          "<p>Welcome to Hotel System.</p>",
          `<p><a href="${verificationUrl}">Verify your email address</a></p>`,
          "<p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>",
        ].join(""),
      });

      if (!sent) {
        await this.invalidateVerificationTokens(input.userId);
        return false;
      }
    } catch (error) {
      await this.invalidateVerificationTokens(input.userId);
      this.logger.error("Email verification delivery failed", error);
      return false;
    }

    await this.createAuditLog({
      actorUserId: input.userId,
      action: "EMAIL_VERIFICATION_SENT",
      entityType: "User",
      entityId: input.userId,
      summary: `Verification email was sent to ${input.email}`,
      metadata: {
        email: input.email,
      },
    });

    return true;
  }

  private async sendEmail(input: { to: string; subject: string; text: string; html: string }) {
    const apiKey = this.config.get<string>("RESEND_API_KEY")?.trim();
    const from = this.config.get<string>("EMAIL_FROM")?.trim();

    if (!apiKey || !from) {
      this.logger.warn(
        `Email sending is not configured (RESEND_API_KEY=${Boolean(apiKey)}, EMAIL_FROM=${Boolean(from)})`,
      );
      return false;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        ...input,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `Email provider rejected message with status ${response.status}: ${responseText}`,
      );
    }

    return true;
  }

  private async invalidateVerificationTokens(userId: string) {
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  private createAuditLog(input: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    metadata: Record<string, string | null>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata,
      },
    });
  }
}
