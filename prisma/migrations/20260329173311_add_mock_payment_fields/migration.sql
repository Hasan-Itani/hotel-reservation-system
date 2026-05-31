-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'MOCK_CARD';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cardHolderName" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "isMock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "methodLabel" TEXT;
