import { Body, Controller, Get, Headers, Inject, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getClientIp } from "../common/rate-limit/client-ip";
import { RateLimitService, type RateLimitResult } from "../common/rate-limit/rate-limit.service";
import { SESSION_TTL_SECONDS, SessionsService } from "./sessions.service";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
}).strict();

@Controller("auth")
export class SessionsController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post("login")
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const parsed = loginSchema.safeParse(body);
    const accountLimiter = await this.rateLimit.check({
      key: `login-account:${parsed.success ? parsed.data.email : "invalid"}`,
      windowMs: LOGIN_WINDOW_MS,
      maxRequests: 5,
    });
    if (!accountLimiter.ok) {
      return this.rejectLimit(reply, accountLimiter, "Too many login attempts. Please try again later.");
    }

    const networkLimiter = await this.rateLimit.check({
      key: `login-ip:${getClientIp(request)}`,
      windowMs: LOGIN_WINDOW_MS,
      maxRequests: 50,
    });
    if (!networkLimiter.ok) {
      return this.rejectLimit(reply, networkLimiter, "Too many login attempts from this network. Please try again later.");
    }

    this.setRateLimitHeaders(reply, accountLimiter);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid email or password format" });
    }

    try {
      const result = await this.sessions.login(parsed.data.email, parsed.data.password);
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error });
      }

      const secure = this.config.get<string>("NODE_ENV") === "production" ? "; Secure" : "";
      reply.header(
        "Set-Cookie",
        `session=${result.token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
      );
      return reply.status(200).send({ message: "Login successful", user: result.user });
    } catch {
      return reply.status(500).send({ error: "Something went wrong during login" });
    }
  }

  @Get("me")
  async getCurrentUser(
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);

    if (!session) {
      return reply.status(401).send({ authenticated: false, user: null });
    }

    return reply.send({ authenticated: true, user: session.user });
  }

  private rejectLimit(reply: FastifyReply, limiter: RateLimitResult, error: string) {
    this.setRateLimitHeaders(reply, limiter);
    reply.header("Retry-After", String(limiter.retryAfterSeconds));
    return reply.status(429).send({ error });
  }

  private setRateLimitHeaders(reply: FastifyReply, limiter: RateLimitResult) {
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));
  }
}
