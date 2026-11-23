import { NextResponse } from "next/server";
import { formatRoomTypeResponse, getRoomTypeById } from "@/apps/api/src/admin-rooms/room-reads";
import { updateRoomType, deleteRoomType } from "@/apps/api/src/admin-rooms/room-type-writes";
import { handleAdminInventoryWrite, proxyAdminRoomRead } from "@/lib/adminRoomReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ hotelId: string; roomTypeId: string }>;
  },
) {
  const { hotelId, roomTypeId } = await params;
  const proxied = await proxyAdminRoomRead(request, hotelId, "room-types", roomTypeId);
  if (proxied) {
    return proxied;
  }

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const roomType = await getRoomTypeById(prisma, hotelId, roomTypeId);

  if (!roomType) {
    return NextResponse.json({ error: "Room type not found" }, { status: 404 });
  }

  return NextResponse.json({
    roomType: formatRoomTypeResponse(roomType),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomTypeId: string }> },
) {
  const { hotelId, roomTypeId } = await params;
  return handleAdminInventoryWrite(request, hotelId, ["room-types", roomTypeId], (user) =>
    updateRoomType(prisma, user, hotelId, roomTypeId, () => request.json()),
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; roomTypeId: string }> },
) {
  const { hotelId, roomTypeId } = await params;
  return handleAdminInventoryWrite(request, hotelId, ["room-types", roomTypeId], (user) =>
    deleteRoomType(prisma, user, hotelId, roomTypeId),
  );
}
