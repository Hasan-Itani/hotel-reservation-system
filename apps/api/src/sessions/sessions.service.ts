import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class SessionsService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getCurrentUser(token: string) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException("Session validation is not configured");
    }

    const { jwtVerify } = await import("jose");
    const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
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
      select: {
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
      },
    });

    if (!user) {
      return null;
    }

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
}
