import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { AuthUser } from "../common/permissions";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { unlockAdminGuest } from "./guest-unlock";
import { listAdminGuests, listAdminStaff, readAdminStaff, type PeopleResult } from "./people-reads";
import { createAdminStaff, updateAdminStaff, removeAdminStaff } from "./staff-writes";

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
    return this.respond(authorization, reply, (user) =>
      listAdminGuests(this.prisma, user, hotelId),
    );
  }

  @Get("staff")
  listAdminStaff(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
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
    return this.respond(authorization, reply, (user) =>
      readAdminStaff(this.prisma, user, hotelId, staffId),
    );
  }

  @Post("guests/:userId/unlock")
  unlockAdminGuest(
    @Param("hotelId") hotelId: string,
    @Param("userId") userId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      unlockAdminGuest(this.prisma, user, hotelId, userId),
    );
  }

  @Post("staff")
  createAdminStaff(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      createAdminStaff(this.prisma, user, hotelId, async () => body),
    );
  }

  @Patch("staff/:staffId")
  updateAdminStaff(
    @Param("hotelId") hotelId: string,
    @Param("staffId") staffId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      updateAdminStaff(this.prisma, user, hotelId, staffId, async () => body),
    );
  }

  @Delete("staff/:staffId")
  removeAdminStaff(
    @Param("hotelId") hotelId: string,
    @Param("staffId") staffId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.respond(authorization, reply, (user) =>
      removeAdminStaff(this.prisma, user, hotelId, staffId),
    );
  }

  private async respond(
    authorization: string | undefined,
    reply: FastifyReply,
    load: (user: AuthUser | null) => Promise<PeopleResult>,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    const result = await load(session?.user ?? null);
    return reply.status(result.status).send(result.body);
  }
}
