import { Body, Controller, Inject, Param, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getClientIp } from "../common/rate-limit/client-ip";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PrismaService } from "../database/prisma.service";
import { createPublicHotelInquiry } from "../inquiries/inquiry-actions";

@Controller("public/hotels")
export class PublicHotelContactController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Post(":slug")
  async submit(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `public-hotel-contact:${getClientIp(request)}:${slug}`,
      windowMs: 10 * 60 * 1000,
      maxRequests: 10,
    });
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({ error: "Too many contact requests. Please try again later." });
    }

    const result = await createPublicHotelInquiry(this.prisma, slug, async () => body);
    return reply.status(result.status).send(result.body);
  }
}
