import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { canAccessHotel, type AuthUser } from "../common/permissions";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { getAdminAvailability } from "./room-availability";
import { formatRoomTypeResponse, getRoomById, getRoomTypeById, listRooms, listRoomTypes } from "./room-reads";

import { createRoom, deleteRoom, updateRoom } from "./room-writes";
import { createRoomType, deleteRoomType, updateRoomType } from "./room-type-writes";
import type { InventoryWriteResult } from "./room-write-access";

@Controller("admin/hotels/:hotelId")
export class AdminRoomsController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get("availability")
  async availability(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    reply.header("Cache-Control", "private, no-store");
    const session = await this.sessions.getCurrentSession(authorization);
    const query = new URL(request.url, "http://localhost").searchParams;
    const result = await getAdminAvailability(this.prisma, session?.user ?? null, hotelId, query);
    return reply.status(result.status).send(result.body);
  }

  @Get("rooms")
  rooms(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, () => listRooms(this.prisma, hotelId));
  }

  @Get("rooms/:roomId")
  room(
    @Param("hotelId") hotelId: string,
    @Param("roomId") roomId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, async () => {
      const room = await getRoomById(this.prisma, hotelId, roomId);
      return room ? { room } : null;
    }, "Room not found");
  }

  @Get("room-types")
  roomTypes(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, () => listRoomTypes(this.prisma, hotelId));
  }

  @Get("room-types/:roomTypeId")
  roomType(
    @Param("hotelId") hotelId: string,
    @Param("roomTypeId") roomTypeId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.read(hotelId, authorization, reply, async () => {
      const roomType = await getRoomTypeById(this.prisma, hotelId, roomTypeId);
      return roomType ? { roomType: formatRoomTypeResponse(roomType) } : null;
    }, "Room type not found");
  }

  @Post("rooms")
  createRoom(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      createRoom(this.prisma, user, hotelId, async () => body),
    );
  }

  @Patch("rooms/:roomId")
  updateRoom(
    @Param("hotelId") hotelId: string,
    @Param("roomId") roomId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      updateRoom(this.prisma, user, hotelId, roomId, async () => body),
    );
  }

  @Delete("rooms/:roomId")
  deleteRoom(
    @Param("hotelId") hotelId: string,
    @Param("roomId") roomId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      deleteRoom(this.prisma, user, hotelId, roomId),
    );
  }

  @Post("room-types")
  createRoomType(
    @Param("hotelId") hotelId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      createRoomType(this.prisma, user, hotelId, async () => body),
    );
  }

  @Patch("room-types/:roomTypeId")
  updateRoomType(
    @Param("hotelId") hotelId: string,
    @Param("roomTypeId") roomTypeId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      updateRoomType(this.prisma, user, hotelId, roomTypeId, async () => body),
    );
  }

  @Delete("room-types/:roomTypeId")
  deleteRoomType(
    @Param("hotelId") hotelId: string,
    @Param("roomTypeId") roomTypeId: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.write(authorization, reply, (user) =>
      deleteRoomType(this.prisma, user, hotelId, roomTypeId),
    );
  }

  private async write(
    authorization: string | undefined,
    reply: FastifyReply,
    execute: (user: AuthUser | null) => Promise<InventoryWriteResult>,
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
    load: () => Promise<object | null>,
    notFound = "Not found",
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
    return result ? reply.send(result) : reply.status(404).send({ error: notFound });
  }
}
