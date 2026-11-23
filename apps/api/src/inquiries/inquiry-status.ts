import type { HotelInquiryStatus } from "@prisma/client";

const statusOrder: Record<HotelInquiryStatus, number> = {
  NEW: 0,
  READ: 1,
  REPLIED: 2,
  ARCHIVED: 3,
};

export function canAdvanceInquiryStatus(current: HotelInquiryStatus, next: HotelInquiryStatus) {
  return statusOrder[next] > statusOrder[current];
}
