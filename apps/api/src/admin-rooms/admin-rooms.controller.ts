import { Controller, Get, Headers, Inject, Param, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { canAccessHotel } from "../common/permissions";
import { PrismaService } from "../database/prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { formatRoomTypeResponse, getRoomById, getRoomTypeById, listRooms, listRoomTypes } from "./room-reads";

@Controller("admin/hotels/:hotelId")
export class AdminRoomsController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

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
