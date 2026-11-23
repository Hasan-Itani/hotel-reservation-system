import { NextResponse } from "next/server";
import { getRoomById } from "@/apps/api/src/admin-rooms/room-reads";
import { updateRoom, deleteRoom } from "@/apps/api/src/admin-rooms/room-writes";
import { handleAdminInventoryWrite, proxyAdminRoomRead } from "@/lib/adminRoomReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; roomId: string }>;
  },
) {
  const { hotelId, roomId } = await params;
  const proxied = await proxyAdminRoomRead(request, hotelId, "rooms", roomId);
  if (proxied) {
    return proxied;
  }

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const room = await getRoomById(prisma, hotelId, roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomId: string }> },
) {
  const { hotelId, roomId } = await params;
  return handleAdminInventoryWrite(request, hotelId, ["rooms", roomId], (user) =>
    updateRoom(prisma, user, hotelId, roomId, () => request.json()),
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomId: string }> },
) {
  const { hotelId, roomId } = await params;
  return handleAdminInventoryWrite(request, hotelId, ["rooms", roomId], (user) =>
    deleteRoom(prisma, user, hotelId, roomId),
  );
}
