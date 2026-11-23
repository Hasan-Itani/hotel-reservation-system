import { NextResponse } from "next/server";
import { readAdminStaff } from "@/apps/api/src/admin-people/people-reads";
import { updateAdminStaff, removeAdminStaff } from "@/apps/api/src/admin-people/staff-writes";
import { handleAdminPeopleWrite, proxyAdminPeopleRead } from "@/lib/adminPeopleReadProxy";
import { getCurrentAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; staffId: string }> },
) {
  const { hotelId, staffId } = await params;
  const proxied = await proxyAdminPeopleRead(request, hotelId, "staff", staffId);
  if (proxied) return proxied;

  const result = await readAdminStaff(prisma, await getCurrentAuthUser(), hotelId, staffId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; staffId: string }> },
) {
  const { hotelId, staffId } = await params;
  return handleAdminPeopleWrite(request, hotelId, ["staff", staffId], true, (user) =>
    updateAdminStaff(prisma, user, hotelId, staffId, () => request.json()),
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; staffId: string }> },
) {
  const { hotelId, staffId } = await params;
  return handleAdminPeopleWrite(request, hotelId, ["staff", staffId], false, (user) =>
    removeAdminStaff(prisma, user, hotelId, staffId),
  );
}
