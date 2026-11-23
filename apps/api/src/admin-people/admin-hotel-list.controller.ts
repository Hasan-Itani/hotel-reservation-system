import { Controller, Get, Headers, Inject, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { listAdminHotels } from "./people-reads";

@Controller("admin/hotels")
export class AdminHotelListController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listHotels(
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    const result = await listAdminHotels(this.prisma, session?.user ?? null);
    return reply.status(result.status).send(result.body);
  }
}
