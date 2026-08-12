import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { RateLimitResult, RateLimitService } from "../common/rate-limit/rate-limit.service";
import {
  GuestAccountsService,
  VERIFICATION_ALREADY_SENT_RESPONSE,
  VERIFICATION_SEND_FAILED_RESPONSE,
} from "./guest-accounts.service";

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

function getRequestOrigin(request: FastifyRequest) {
  const host = getHeaderValue(request.headers["x-forwarded-host"]) || request.headers.host;
  const protocol =
    getHeaderValue(request.headers["x-forwarded-proto"]) || request.protocol;

  return `${protocol}://${host}`;
}

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number")
  .regex(/[^A-Za-z0-9\s]/, "Password must include a symbol");

const guestRegisterSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email(),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((value) => (value === undefined || value.length === 0 ? null : value)),
    password: passwordSchema,
  })
  .strict();

@Controller("guest")
export class GuestAccountsController {
  constructor(
    @Inject(GuestAccountsService)
    private readonly guestAccounts: GuestAccountsService,
    @Inject(RateLimitService)
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post("register")
  async register(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `guest-register:${getClientIp(request)}`,
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    });
    this.setRateLimitHeaders(reply, limiter);

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({
        error: "Too many registration attempts. Please try again later.",
      });
    }

    const parsed = guestRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid registration data",
        details: parsed.error.flatten(),
      });
    }

    const result = await this.guestAccounts.register(
      parsed.data,
      getRequestOrigin(request),
    );

    switch (result.type) {
      case "already-sent":
        return reply.send({ message: VERIFICATION_ALREADY_SENT_RESPONSE });
      case "resent":
        return reply.send({
          message: "Verification email sent. Check your inbox before signing in.",
        });
      case "already-exists":
        return reply.status(409).send({
          error: "An account with this email already exists",
        });
      case "unusable-email":
        return reply.status(409).send({ error: "This email cannot be used" });
      case "send-failed":
        return reply.status(503).send({
          error: VERIFICATION_SEND_FAILED_RESPONSE,
        });
      case "created":
        return reply.status(201).send({
          message:
            "Account created. Check your email and verify your address before signing in.",
        });
    }
  }

  private setRateLimitHeaders(reply: FastifyReply, limiter: RateLimitResult) {
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));
  }
}
