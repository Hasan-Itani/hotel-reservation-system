-- CreateEnum
CREATE TYPE "HotelInquiryType" AS ENUM ('GENERAL', 'RESERVATION', 'PAYMENT', 'DINING', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "HotelInquiryStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "HotelInquiry" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "inquiryType" "HotelInquiryType" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "HotelInquiryStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelInquiry_hotelId_idx" ON "HotelInquiry"("hotelId");

-- CreateIndex
CREATE INDEX "HotelInquiry_hotelId_status_createdAt_idx" ON "HotelInquiry"("hotelId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HotelInquiry_guestEmail_idx" ON "HotelInquiry"("guestEmail");

-- CreateIndex
CREATE INDEX "HotelInquiry_createdAt_idx" ON "HotelInquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "HotelInquiry" ADD CONSTRAINT "HotelInquiry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
