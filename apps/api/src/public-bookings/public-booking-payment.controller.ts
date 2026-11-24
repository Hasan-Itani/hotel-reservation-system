import { Body, Controller, Headers, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isPaidPaymentResponse } from "../booking-domain/paid-confirmation-email";
import { tryPaymentReceipt } from "../booking-domain/payment-receipt";
import { tryPaidBookingConfirmation } from "../booking-domain/paid-confirmation-mailer";
import { submitPublicPayment } from "../booking-domain/submit-public-payment";
import { getClientIp } from "../common/rate-limit/client-ip";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { getResendSender } from "../common/resend-sender";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";

@Controller("public/bookings")
export class PublicBookingPaymentController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post(":reservationNumber/pay")
  async pay(
    @Param("reservationNumber") reservationNumber: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const limiter = await this.rateLimit.check({
      key: `booking-pay:${getClientIp(request)}`,
      windowMs: 10 * 60 * 1000,
      maxRequests: 5,
    });
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-RateLimit-Limit", String(limiter.limit));
    reply.header("X-RateLimit-Remaining", String(limiter.remaining));
    reply.header("X-RateLimit-Reset", String(limiter.resetAt));

    if (!limiter.ok) {
      reply.header("Retry-After", String(limiter.retryAfterSeconds));
      return reply.status(429).send({ error: "Too many payment attempts. Please try again later." });
    }

    const result = await submitPublicPayment(this.prisma, reservationNumber, body, async () => {
      const session = await this.sessions.getCurrentSession(authorization);
      return session?.user ?? null;
    });
    if ("paymentReceipt" in result && result.paymentReceipt) {
      await tryPaymentReceipt(this.prisma, result.paymentReceipt, getResendSender(this.config, this.prisma));
    } else if (isPaidPaymentResponse(result)) {
      await tryPaidBookingConfirmation(this.prisma, this.config, { reservationNumber: reservationNumber.trim().toUpperCase() });
    }
    return reply.status(result.status).send(result.body);
  }
}
