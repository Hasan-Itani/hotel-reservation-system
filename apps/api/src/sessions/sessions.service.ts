import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../database/prisma.service";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const accountSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  userRoles: { select: { role: { select: { name: true } } } },
  UserHotelRole: {
    select: {
      hotelId: true,
      Hotel: { select: { name: true } },
      Role: { select: { name: true } },
    },
  },
} satisfies Prisma.UserSelect;

function serializeAccount(user: Prisma.UserGetPayload<{ select: typeof accountSelect }>) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    globalRoles: user.userRoles.map(({ role }) => role.name),
    hotelRoles: user.UserHotelRole.map(({ hotelId, Hotel, Role }) => ({
      hotelId,
      hotelName: Hotel.name,
      role: Role.name,
    })),
  };
}

function loginFailure(status: number, error: string) {
  return { ok: false as const, status, error };
}

@Injectable()
export class SessionsService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    const secret = this.getSecretKey();
    const result = await this.prisma.$transaction(async (tx) => {
      const [account] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "email" = ${email} FOR UPDATE
      `;
      if (!account) {
        return loginFailure(401, "Invalid email or password");
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: account.id },
        select: {
          ...accountSelect,
          deletedAt: true,
          lockedUntil: true,
          failedLoginAttempts: true,
          passwordHash: true,
          sessionVersion: true,
        },
      });

      if (user.deletedAt) {
        return loginFailure(403, "Account is unavailable");
      }
      if (user.status !== "ACTIVE") {
        return loginFailure(403, "Account is not active");
      }
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return loginFailure(423, "Account is temporarily locked. Try again later.");
      }
      if (!user.emailVerifiedAt && user.userRoles.length === 0 && user.UserHotelRole.length === 0) {
        return loginFailure(403, "Please verify your email before signing in.");
      }

      if (!(await bcrypt.compare(password, user.passwordHash))) {
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        const shouldLock = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: shouldLock ? 0 : failedLoginAttempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
          },
        });

        if (shouldLock) {
          await tx.auditLog.create({
            data: {
              actorUserId: user.id,
              action: "ACCOUNT_LOCKED",
              entityType: "User",
              entityId: user.id,
              summary: "Account was locked after too many failed login attempts",
              metadata: { email: user.email, lockMinutes: LOCK_MINUTES },
            },
          });
        }

        return loginFailure(
          401,
          shouldLock ? "Too many failed attempts. Account locked for 15 minutes." : "Invalid email or password",
        );
      }

      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      return { ok: true as const, user: serializeAccount(user), sessionVersion: user.sessionVersion };
    });

    if (!result.ok) {
      return result;
    }

    const { SignJWT } = await import("jose");
    const token = await new SignJWT({
      sub: result.user.id,
      email: result.user.email,
      sessionVersion: result.sessionVersion,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
      .sign(secret);

    return { ok: true as const, user: result.user, token };
  }

  async getCurrentSession(authorization: string | undefined) {
    const token = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    if (!token) {
      return null;
    }

    const secret = this.getSecretKey();
    const { jwtVerify } = await import("jose");
    const verified = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      requiredClaims: ["sub", "exp", "sessionVersion"],
    }).catch(() => null);

    const userId = verified?.payload.sub;
    const sessionVersion = verified?.payload.sessionVersion;
    if (
      typeof userId !== "string" ||
      !userId ||
      typeof sessionVersion !== "number" ||
      !Number.isSafeInteger(sessionVersion)
    ) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, status: "ACTIVE", deletedAt: null, sessionVersion },
      select: accountSelect,
    });

    if (!user) {
      return null;
    }

    return { user: serializeAccount(user), sessionVersion };
  }

  private getSecretKey() {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException("Session validation is not configured");
    }

    return new TextEncoder().encode(secret);
  }
}
