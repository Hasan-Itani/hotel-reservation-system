import { NextResponse } from "next/server";
import { getAdminAvailability } from "@/apps/api/src/admin-rooms/room-availability";
import { proxyAdminRoomRead } from "@/lib/adminRoomReadProxy";
import { getCurrentAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  const proxied = await proxyAdminRoomRead(request, hotelId, "availability");
  if (proxied) return proxied;

  const query = new URL(request.url).searchParams;
  const result = await getAdminAvailability(prisma, await getCurrentAuthUser(), hotelId, query);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
