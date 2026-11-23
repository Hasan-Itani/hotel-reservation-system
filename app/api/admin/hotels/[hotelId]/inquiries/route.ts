import { listAdminInquiries } from "@/apps/api/src/inquiries/inquiry-actions";
import { handleAdminActivity } from "@/lib/adminActivityProxy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;
  return handleAdminActivity(request, hotelId, ["inquiries"], (user) =>
    listAdminInquiries(prisma, user, hotelId),
  );
}
