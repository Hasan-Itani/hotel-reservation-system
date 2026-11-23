import { NextResponse } from "next/server";
import { listRoomTypes } from "@/apps/api/src/admin-rooms/room-reads";
import { createRoomType } from "@/apps/api/src/admin-rooms/room-type-writes";
import { handleAdminInventoryWrite, proxyAdminRoomRead } from "@/lib/adminRoomReadProxy";
import { requireHotelAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  const proxied = await proxyAdminRoomRead(request, hotelId, "room-types");
  if (proxied) {
    return proxied;
  }

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json(await listRoomTypes(prisma, hotelId));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return handleAdminInventoryWrite(request, hotelId, ["room-types"], (user) =>
    createRoomType(prisma, user, hotelId, () => request.json()),
  );
}
