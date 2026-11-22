import { Controller, Get, Headers, Inject, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { SessionsService } from "./sessions.service";

@Controller("auth")
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly sessions: SessionsService) {}

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
}
