import { listHotelAudit } from "@/apps/api/src/inquiries/audit-reads";
import { handleAdminActivity } from "@/lib/adminActivityProxy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return handleAdminActivity(request, hotelId, ["audit"], (user) =>
    listHotelAudit(prisma, user, hotelId, new URL(request.url).searchParams),
  );
}
