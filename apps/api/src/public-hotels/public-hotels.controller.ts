import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
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

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    { message: "Date must be a valid calendar date" },
  );

const availabilityQuerySchema = z
  .object({
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    adults: z.coerce.number().int().min(1).max(20).optional(),
    children: z.coerce.number().int().min(0).max(20).optional(),
  })
  .strict()
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: "checkOutDate must be after checkInDate",
    path: ["checkOutDate"],
  });

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

  @Get(":slug/availability")
  async getAvailability(
    @Param("slug") slug: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `public-availability:${getClientIp(request)}:${slug}`,
      windowMs: 5 * 60 * 1000,
      maxRequests: 60,
    });
    this.setRateLimitHeaders(reply, limiter);

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({
        error: "Too many availability requests. Please try again later.",
      });
    }

    const url = new URL(request.url, "http://localhost");
    const parsedQuery = availabilityQuerySchema.safeParse({
      checkInDate: url.searchParams.get("checkInDate"),
      checkOutDate: url.searchParams.get("checkOutDate"),
      adults: url.searchParams.get("adults") ?? undefined,
      children: url.searchParams.get("children") ?? undefined,
    });

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedQuery.error.flatten(),
      });
    }

    const availability = await this.publicHotels.findAvailability({
      slug,
      ...parsedQuery.data,
    });

    if (!availability) {
      return reply.status(404).send({ error: "Hotel not found" });
    }

    return reply.send({
      hotel: availability.hotel,
      checkInDate: parsedQuery.data.checkInDate,
      checkOutDate: parsedQuery.data.checkOutDate,
      roomTypes: availability.roomTypes,
    });
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
