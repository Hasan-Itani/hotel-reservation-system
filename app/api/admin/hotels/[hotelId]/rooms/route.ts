import { NextResponse } from "next/server";
import { listRooms } from "@/apps/api/src/admin-rooms/room-reads";
import { createRoom } from "@/apps/api/src/admin-rooms/room-writes";
import { handleAdminInventoryWrite, proxyAdminRoomRead } from "@/lib/adminRoomReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  const proxied = await proxyAdminRoomRead(request, hotelId, "rooms");
  if (proxied) {
    return proxied;
  }

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json(await listRooms(prisma, hotelId));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return handleAdminInventoryWrite(request, hotelId, ["rooms"], (user) =>
    createRoom(prisma, user, hotelId, () => request.json()),
  );
}
