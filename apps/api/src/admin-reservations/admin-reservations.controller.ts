import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isPaidPaymentResponse } from "../booking-domain/paid-confirmation-email";
import { tryPaymentReceipt } from "../booking-domain/payment-receipt";
import { tryPaidBookingConfirmation } from "../booking-domain/paid-confirmation-mailer";
import { canAccessHotel, type AuthUser } from "../common/permissions";
import { getResendSender } from "../common/resend-sender";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { listAdminReservations, listAdminReservationPayments, readAdminReservation, readAdminReservationPayment } from "./reservation-reads";

import { createAdminMockPayment, updateAdminPaymentStatus, type PaymentWriteResult } from "./payment-writes";
import { notifyCheckoutSummary } from "./checkout-summary";
import { notifyCancellation } from "./cancellation-email";
import { notifyMockRefund } from "./refund-notice";
import { createAdminReservation, updateAdminReservation } from "./reservation-writes";
import type { ReservationWriteResult } from "./reservation-write-access";

@Controller("admin/hotels/:hotelId/reservations")
export class AdminReservationsController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Get()
  listAdminReservations(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, () =>
      listAdminReservations(this.prisma, hotelId, new URL(request.url, "http://localhost").searchParams),
    );
  }

  @Get(":reservationId")
  readAdminReservation(
    @Param("hotelId") hotelId: string,
    @Param("reservationId") reservationId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, () =>
      readAdminReservation(this.prisma, hotelId, reservationId),
    );
  }

  @Get(":reservationId/payments")
  listAdminReservationPayments(
    @Param("hotelId") hotelId: string,
    @Param("reservationId") reservationId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, () =>
      listAdminReservationPayments(this.prisma, hotelId, reservationId),
    );
  }

  @Get(":reservationId/payments/:paymentId")
  readAdminReservationPayment(
    @Param("hotelId") hotelId: string,
    @Param("reservationId") reservationId: string,
    @Param("paymentId") paymentId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, () =>
      readAdminReservationPayment(this.prisma, hotelId, reservationId, paymentId),
    );
  }

  @Post()
  create(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      createAdminReservation(this.prisma, user, hotelId, async () => body),
    );
  }

  @Patch(":reservationId")
  update(
    @Param("hotelId") hotelId: string,
    @Param("reservationId") reservationId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, async (user) => {
      const result = await updateAdminReservation(this.prisma, user, hotelId, reservationId, async () => body);
      const scope = { hotelId, reservationId };
      const send = getResendSender(this.config);
      return result.cancellationCompleted
        ? notifyCancellation(this.prisma, scope, result, send)
        : notifyCheckoutSummary(this.prisma, scope, result, send);
    });
  }

  @Post(":reservationId/payments")
  createPayment(
    @Param("hotelId") hotelId: string,
    @Param("reservationId") reservationId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, async (user) =>
      this.notifyPayment(reservationId, await createAdminMockPayment(this.prisma, user, hotelId, reservationId, async () => body)),
    );
  }

  @Patch(":reservationId/payments/:paymentId")
  updatePayment(
    @Param("hotelId") hotelId: string,
    @Param("reservationId") reservationId: string,
    @Param("paymentId") paymentId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, async (user) => {
      const result = await updateAdminPaymentStatus(this.prisma, user, hotelId, reservationId, paymentId, async () => body);
      await this.notifyPayment(reservationId, result);
      return notifyMockRefund(this.prisma, { hotelId, reservationId, paymentId }, result, getResendSender(this.config));
    });
  }

  private async notifyPayment(reservationId: string, result: PaymentWriteResult) {
    if (result.paymentReceipt) {
      await tryPaymentReceipt(this.prisma, result.paymentReceipt, getResendSender(this.config));
    } else if (isPaidPaymentResponse(result)) {
      await tryPaidBookingConfirmation(this.prisma, this.config, { id: reservationId });
    }
    return result;
  }

  private async write(
    authorization: string | undefined,
    reply: FastifyReply,
    execute: (user: AuthUser | null) => Promise<ReservationWriteResult>,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    const result = await execute(session?.user ?? null);
    return reply.status(result.status).send(result.body);
  }

  private async read(
    hotelId: string,
    authorization: string | undefined,
    reply: FastifyReply,
    load: () => Promise<{ status: number; body: object }>,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    if (!canAccessHotel(session.user, hotelId)) {
      return reply.status(403).send({ error: "You do not have access to this hotel" });
    }

    const result = await load();
    return reply.status(result.status).send(result.body);
  }
}
