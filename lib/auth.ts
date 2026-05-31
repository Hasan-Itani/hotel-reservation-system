import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { getSessionToken, signSession, verifySession } from "@/lib/session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function isLocked(lockedUntil: Date | null) {
  return !!lockedUntil && lockedUntil > new Date();
}

function lockUntilDate() {
  return new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
}

export async function authenticateUser(rawInput: LoginInput) {
  const parsed = loginSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid email or password format",
    };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      UserHotelRole: {
        include: {
          Role: true,
          Hotel: true,
        },
      },
    },
  });

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      error: "Invalid email or password",
    };
  }

  if (user.deletedAt) {
    return {
      ok: false as const,
      status: 403,
      error: "Account is unavailable",
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 403,
      error: "Account is not active",
    };
  }

  if (isLocked(user.lockedUntil)) {
    return {
      ok: false as const,
      status: 423,
      error: "Account is temporarily locked. Try again later.",
    };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    const nextFailedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = nextFailedAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : nextFailedAttempts,
        lockedUntil: shouldLock ? lockUntilDate() : null,
      },
    });

    return {
      ok: false as const,
      status: 401,
      error: shouldLock
        ? "Too many failed attempts. Account locked for 15 minutes."
        : "Invalid email or password",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
  });

  return {
    ok: true as const,
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      globalRoles: user.userRoles.map((item) => item.role.name),
      hotelRoles: user.UserHotelRole.map((item) => ({
        hotelId: item.hotelId,
        hotelName: item.Hotel.name,
        role: item.Role.name,
      })),
    },
  };
}

export async function getCurrentAuthUser() {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  try {
    const payload = await verifySession(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        UserHotelRole: {
          include: {
            Role: true,
            Hotel: true,
          },
        },
      },
    });

    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      globalRoles: user.userRoles.map((item) => item.role.name),
      hotelRoles: user.UserHotelRole.map((item) => ({
        hotelId: item.hotelId,
        hotelName: item.Hotel.name,
        role: item.Role.name,
      })),
    };
  } catch {
    return null;
  }
}
