import { NextResponse } from "next/server";
import { listAdminStaff } from "@/apps/api/src/admin-people/people-reads";
import { createAdminStaff } from "@/apps/api/src/admin-people/staff-writes";
import { handleAdminPeopleWrite, proxyAdminPeopleRead } from "@/lib/adminPeopleReadProxy";
import { getCurrentAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  const proxied = await proxyAdminPeopleRead(request, hotelId, "staff");
  if (proxied) return proxied;

  const result = await listAdminStaff(prisma, await getCurrentAuthUser(), hotelId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return handleAdminPeopleWrite(request, hotelId, ["staff"], true, (user) =>
    createAdminStaff(prisma, user, hotelId, () => request.json()),
  );
}
