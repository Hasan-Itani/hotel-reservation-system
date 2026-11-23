import { Controller, Get, Headers, Inject, Param, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { AuthUser } from "../common/permissions";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { listAdminGuests, listAdminStaff, readAdminStaff } from "./people-reads";

@Controller("admin/hotels/:hotelId")
export class AdminPeopleController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get("guests")
  listAdminGuests(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(authorization, reply, (user) =>
      listAdminGuests(this.prisma, user, hotelId),
    );
  }

  @Get("staff")
  listAdminStaff(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(authorization, reply, (user) =>
      listAdminStaff(this.prisma, user, hotelId),
    );
  }

  @Get("staff/:staffId")
  readAdminStaff(
    @Param("hotelId") hotelId: string,
    @Param("staffId") staffId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(authorization, reply, (user) =>
      readAdminStaff(this.prisma, user, hotelId, staffId),
    );
  }

  private async read(
    authorization: string | undefined,
    reply: FastifyReply,
    load: (user: AuthUser | null) => Promise<{ status: number; body: object }>,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    const result = await load(session?.user ?? null);
    return reply.status(result.status).send(result.body);
  }
}
