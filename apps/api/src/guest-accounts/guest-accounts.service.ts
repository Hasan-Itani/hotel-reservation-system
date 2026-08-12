import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { PrismaService } from "../database/prisma.service";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

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

  private async sendVerificationEmail(input: {
    email: string;
    origin: string;
    userId: string;
  }) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
      },
    });

    try {
      const sent = await this.sendEmail({
        to: input.email,
        verificationUrl: `${input.origin}/guest/verify-email?token=${encodeURIComponent(token)}`,
      });

      if (!sent) {
        await this.invalidateVerificationTokens(input.userId);
        return false;
      }
    } catch {
      await this.invalidateVerificationTokens(input.userId);
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

  private async sendEmail(input: { to: string; verificationUrl: string }) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("EMAIL_FROM");

    if (!apiKey || !from) {
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
        to: input.to,
        subject: "Verify your Hotel System email",
        text: [
          "Welcome to Hotel System.",
          "",
          "Open this secure link to verify your email address:",
          input.verificationUrl,
          "",
          "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
        ].join("\n"),
        html: [
          "<p>Welcome to Hotel System.</p>",
          `<p><a href="${input.verificationUrl}">Verify your email address</a></p>`,
          "<p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>",
        ].join(""),
      }),
    });

    return response.ok;
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
