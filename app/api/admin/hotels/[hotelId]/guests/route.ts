import { NextResponse } from "next/server";
import { listAdminGuests } from "@/apps/api/src/admin-people/people-reads";
import { proxyAdminPeopleRead } from "@/lib/adminPeopleReadProxy";
import { getCurrentAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  const proxied = await proxyAdminPeopleRead(request, hotelId, "guests");
  if (proxied) return proxied;

  const result = await listAdminGuests(prisma, await getCurrentAuthUser(), hotelId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
