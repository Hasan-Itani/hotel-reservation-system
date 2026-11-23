import { updateAdminInquiry } from "@/apps/api/src/inquiries/inquiry-actions";
import { handleAdminActivity } from "@/lib/adminActivityProxy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hotelId: string; inquiryId: string }> },
) {
  const { hotelId, inquiryId } = await params;
  return handleAdminActivity(request, hotelId, ["inquiries", inquiryId], (user) =>
    updateAdminInquiry(prisma, user, hotelId, inquiryId, () => request.json()),
  );
}
