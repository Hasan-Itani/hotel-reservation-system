import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { RateLimitResult, RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PublicBookingsService } from "./public-bookings.service";

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

const bookingLookupSchema = z
  .object({
    reservationNumber: z
      .string()
      .trim()
      .min(6)
      .max(50)
      .transform((value) => value.toUpperCase()),
    guestEmail: z.string().trim().toLowerCase().email(),
  })
  .strict();

@Controller("public/bookings")
export class PublicBookingsController {
  constructor(
    @Inject(PublicBookingsService)
    private readonly publicBookings: PublicBookingsService,
    @Inject(RateLimitService)
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post("lookup")
  async lookupBooking(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `booking-lookup:${getClientIp(request)}`,
      windowMs: 10 * 60 * 1000,
      maxRequests: 10,
    });
    this.setRateLimitHeaders(reply, limiter);

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({
        error: "Too many booking lookup attempts. Please try again later.",
      });
    }

    const parsedBody = bookingLookupSchema.safeParse(body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid lookup data",
        details: parsedBody.error.flatten(),
      });
    }

    try {
      const booking = await this.publicBookings.findByReservationNumberAndGuestEmail(
        parsedBody.data.reservationNumber,
        parsedBody.data.guestEmail,
      );

      if (!booking) {
        return reply.status(404).send({ error: "Booking not found" });
      }

      return reply.send({
        message: "Booking found",
        booking,
      });
    } catch {
      return reply.status(500).send({ error: "Failed to look up booking" });
    }
  }

  private setRateLimitHeaders(reply: FastifyReply, limiter: RateLimitResult) {
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));
  }
}
