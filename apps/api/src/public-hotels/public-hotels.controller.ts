import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { RateLimitResult, RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PublicHotelsService } from "./public-hotels.service";

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(request: FastifyRequest) {
  const forwardedFor = getHeaderValue(request.headers["x-forwarded-for"]);
  const rawIp =
    forwardedFor?.split(",")[0]?.trim() ||
    getHeaderValue(request.headers["x-real-ip"]) ||
    getHeaderValue(request.headers["cf-connecting-ip"]) ||
    getHeaderValue(request.headers["true-client-ip"]) ||
    getHeaderValue(request.headers["x-client-ip"]) ||
    request.ip ||
    "unknown";

  if (rawIp === "::1") {
    return "127.0.0.1";
  }

  return rawIp.startsWith("::ffff:") ? rawIp.replace("::ffff:", "") : rawIp;
}

@Controller("public/hotels")
export class PublicHotelsController {
  constructor(
    @Inject(PublicHotelsService)
    private readonly publicHotels: PublicHotelsService,
    @Inject(RateLimitService)
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get()
  async getHotels(@Res() reply: FastifyReply) {
    return reply.send(await this.publicHotels.findAll());
  }

  @Get(":slug")
  async getHotel(
    @Param("slug") slug: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `public-hotel-detail:${getClientIp(request)}:${slug}`,
      windowMs: 5 * 60 * 1000,
      maxRequests: 120,
    });
    this.setRateLimitHeaders(reply, limiter);

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({
        error: "Too many requests. Please try again later.",
      });
    }

    const hotel = await this.publicHotels.findBySlug(slug);

    if (!hotel) {
      return reply.status(404).send({ error: "Hotel not found" });
    }

    return reply.send({ hotel });
  }

  @Get(":slug/room-types")
  async getRoomTypes(
    @Param("slug") slug: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `public-room-types:${getClientIp(request)}:${slug}`,
      windowMs: 5 * 60 * 1000,
      maxRequests: 120,
    });
    this.setRateLimitHeaders(reply, limiter);

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({
        error: "Too many room type requests. Please try again later.",
      });
    }

    const result = await this.publicHotels.findRoomTypes(slug);

    if (!result) {
      return reply.status(404).send({ error: "Hotel not found" });
    }

    return reply.send(result);
  }

  private setRateLimitHeaders(reply: FastifyReply, limiter: RateLimitResult) {
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));
  }
}
