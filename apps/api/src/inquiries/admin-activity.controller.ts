import { Body, Controller, Get, Headers, Inject, Param, Patch, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser } from "../common/permissions";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import type { ActivityResult } from "./activity-response";
import { listHotelAudit } from "./audit-reads";
import { listAdminInquiries, updateAdminInquiry } from "./inquiry-actions";

@Controller("admin/hotels/:hotelId")
export class AdminActivityController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get("inquiries")
  listAdminInquiries(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      listAdminInquiries(this.prisma, user, hotelId),
    );
  }

  @Patch("inquiries/:inquiryId")
  updateAdminInquiry(
    @Param("hotelId") hotelId: string,
    @Param("inquiryId") inquiryId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      updateAdminInquiry(this.prisma, user, hotelId, inquiryId, async () => body),
    );
  }

  @Get("audit")
  listHotelAudit(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      listHotelAudit(this.prisma, user, hotelId, new URL(request.url, "http://localhost").searchParams),
    );
  }

  private async respond(
    authorization: string | undefined,
    reply: FastifyReply,
    load: (user: AuthUser | null) => Promise<ActivityResult>,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    const result = await load(session?.user ?? null);
    return reply.status(result.status).send(result.body);
  }
}
