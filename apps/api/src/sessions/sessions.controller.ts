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
    const token = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    const user = token ? await this.sessions.getCurrentUser(token) : null;

    if (!user) {
      return reply.status(401).send({ authenticated: false, user: null });
    }

    return reply.send({ authenticated: true, user });
  }
}
