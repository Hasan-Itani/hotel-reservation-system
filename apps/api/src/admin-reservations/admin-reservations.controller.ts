import { Controller, Get, Headers, Inject, Param, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { canAccessHotel } from "../common/permissions";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { listAdminReservations, listAdminReservationPayments, readAdminReservation, readAdminReservationPayment } from "./reservation-reads";

@Controller("admin/hotels/:hotelId/reservations")
export class AdminReservationsController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
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
