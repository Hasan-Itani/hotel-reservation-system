import { Body, Controller, Headers, Inject, Param, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createPublicReservation } from "../booking-domain/create-public-reservation";
import { publicReservationCreateSchema } from "../booking-domain/public-reservation-schema";
import { getClientIp } from "../common/rate-limit/client-ip";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";

@Controller("public/hotels")
export class PublicHotelBookingController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  @Post(":slug/book")
  async book(
    @Param("slug") slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `public-booking-create:${getClientIp(request)}:${slug}`,
      windowMs: 10 * 60 * 1000,
      maxRequests: 5,
    });
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));

    const session = await this.sessions.getCurrentSession(authorization);
    if (!session) {
      return reply.status(401).send({ error: "You must sign in before booking." });
    }
    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({ error: "Too many booking attempts. Please try again later." });
    }

    const parsed = publicReservationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const result = await createPublicReservation(
      this.prisma,
      slug,
      { id: session.user.id, sessionVersion: session.sessionVersion },
      parsed.data,
    );
    return reply.status(result.status).send(result.body);
  }
}
