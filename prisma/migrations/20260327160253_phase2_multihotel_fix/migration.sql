-- This is an empty migration.BEGIN;

-- =========================================================
-- Phase 2 hardening patch for a MULTI-HOTEL reservation schema
-- Use this INSTEAD of the earlier phase2_fix.sql if you have not applied it.
-- Apply as a NEW migration.
-- =========================================================

-- 1) Hotel improvements
ALTER TABLE "Hotel"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Hotel"
SET "timezone" = 'Asia/Beirut'
WHERE "country" = 'Lebanon'
  AND "city" = 'Beirut'
  AND "timezone" = 'UTC';

ALTER TABLE "Hotel"
  ADD CONSTRAINT "Hotel_starRating_check"
  CHECK ("starRating" IS NULL OR "starRating" BETWEEN 1 AND 5);

-- 2) User/auth hardening fields
ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD CONSTRAINT "User_failedLoginAttempts_check"
  CHECK ("failedLoginAttempts" >= 0);

-- 3) Soft delete support on inventory/catalog tables
ALTER TABLE "RoomType"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Room"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Amenity"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 4) Multi-hotel staff access
-- Keep UserRole for truly GLOBAL roles like SUPER_ADMIN.
-- Add UserHotelRole for hotel-scoped roles like HOTEL_ADMIN, MANAGER, RECEPTIONIST.
CREATE TABLE "UserHotelRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserHotelRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserHotelRole_userId_hotelId_roleId_key"
  ON "UserHotelRole"("userId", "hotelId", "roleId");

CREATE INDEX "UserHotelRole_userId_idx" ON "UserHotelRole"("userId");
CREATE INDEX "UserHotelRole_hotelId_idx" ON "UserHotelRole"("hotelId");
CREATE INDEX "UserHotelRole_roleId_idx" ON "UserHotelRole"("roleId");
CREATE INDEX "UserHotelRole_hotelId_roleId_idx" ON "UserHotelRole"("hotelId", "roleId");

ALTER TABLE "UserHotelRole"
  ADD CONSTRAINT "UserHotelRole_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserHotelRole"
  ADD CONSTRAINT "UserHotelRole_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserHotelRole"
  ADD CONSTRAINT "UserHotelRole_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) RoomTypeImage improvements
ALTER TABLE "RoomTypeImage"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RoomTypeImage"
  ADD CONSTRAINT "RoomTypeImage_sortOrder_check"
  CHECK ("sortOrder" >= 0);

-- 6) Convert reservation stay dates from timestamp to date
ALTER TABLE "Reservation"
  ALTER COLUMN "checkInDate" TYPE DATE USING "checkInDate"::date,
  ALTER COLUMN "checkOutDate" TYPE DATE USING "checkOutDate"::date;

-- 7) Reservation lifecycle and pricing details
ALTER TABLE "Reservation"
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "checkedInAt" TIMESTAMP(3),
  ADD COLUMN "checkedOutAt" TIMESTAMP(3),
  ADD COLUMN "noShowAt" TIMESTAMP(3),
  ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "serviceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_date_range_check"
  CHECK ("checkOutDate" > "checkInDate"),
  ADD CONSTRAINT "Reservation_adults_check"
  CHECK ("adults" >= 1),
  ADD CONSTRAINT "Reservation_children_check"
  CHECK ("children" >= 0),
  ADD CONSTRAINT "Reservation_subtotal_check"
  CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "Reservation_taxes_check"
  CHECK ("taxes" >= 0),
  ADD CONSTRAINT "Reservation_discountAmount_check"
  CHECK ("discountAmount" >= 0),
  ADD CONSTRAINT "Reservation_serviceFee_check"
  CHECK ("serviceFee" >= 0),
  ADD CONSTRAINT "Reservation_total_check"
  CHECK ("total" >= 0);

-- 8) RoomType validation
ALTER TABLE "RoomType"
  ADD CONSTRAINT "RoomType_basePrice_check"
  CHECK ("basePrice" >= 0),
  ADD CONSTRAINT "RoomType_capacityAdults_check"
  CHECK ("capacityAdults" >= 1),
  ADD CONSTRAINT "RoomType_capacityChildren_check"
  CHECK ("capacityChildren" >= 0),
  ADD CONSTRAINT "RoomType_roomSizeSqm_check"
  CHECK ("roomSizeSqm" IS NULL OR "roomSizeSqm" > 0);

-- 9) ReservationRoom validation
ALTER TABLE "ReservationRoom"
  ADD CONSTRAINT "ReservationRoom_nightlyPrice_check"
  CHECK ("nightlyPrice" >= 0),
  ADD CONSTRAINT "ReservationRoom_guests_check"
  CHECK ("guests" >= 1);

-- 10) Payment validation
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_check"
  CHECK ("amount" > 0);

-- 11) Performance indexes for common booking/admin queries
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "Hotel_city_country_idx" ON "Hotel"("city", "country");
CREATE INDEX "Hotel_deletedAt_idx" ON "Hotel"("deletedAt");

CREATE INDEX "RoomType_hotelId_idx" ON "RoomType"("hotelId");
CREATE INDEX "RoomType_deletedAt_idx" ON "RoomType"("deletedAt");

CREATE INDEX "Room_hotelId_idx" ON "Room"("hotelId");
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");
CREATE INDEX "Room_status_idx" ON "Room"("status");
CREATE INDEX "Room_deletedAt_idx" ON "Room"("deletedAt");

CREATE UNIQUE INDEX "RoomTypeImage_roomTypeId_sortOrder_key"
  ON "RoomTypeImage"("roomTypeId", "sortOrder");

CREATE UNIQUE INDEX "RoomTypeImage_primary_per_roomType_key"
  ON "RoomTypeImage"("roomTypeId")
  WHERE "isPrimary" = true;

CREATE INDEX "Reservation_hotelId_idx" ON "Reservation"("hotelId");
CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_checkInDate_idx" ON "Reservation"("checkInDate");
CREATE INDEX "Reservation_checkOutDate_idx" ON "Reservation"("checkOutDate");
CREATE INDEX "Reservation_hotelId_status_checkInDate_checkOutDate_idx"
  ON "Reservation"("hotelId", "status", "checkInDate", "checkOutDate");
CREATE INDEX "Reservation_guestEmail_idx" ON "Reservation"("guestEmail");

CREATE INDEX "ReservationRoom_reservationId_idx" ON "ReservationRoom"("reservationId");
CREATE INDEX "ReservationRoom_roomId_idx" ON "ReservationRoom"("roomId");
CREATE INDEX "ReservationRoom_roomTypeId_idx" ON "ReservationRoom"("roomTypeId");

CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");
CREATE UNIQUE INDEX "Payment_provider_providerReference_key"
  ON "Payment"("provider", "providerReference")
  WHERE "providerReference" IS NOT NULL;

COMMIT;
