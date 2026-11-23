import { unlockAdminGuest } from "@/apps/api/src/admin-people/guest-unlock";
import { handleAdminPeopleWrite } from "@/lib/adminPeopleReadProxy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; userId: string }> },
) {
  const { hotelId, userId } = await params;
  return handleAdminPeopleWrite(request, hotelId, ["guests", userId, "unlock"], false, (user) =>
    unlockAdminGuest(prisma, user, hotelId, userId),
  );
}
