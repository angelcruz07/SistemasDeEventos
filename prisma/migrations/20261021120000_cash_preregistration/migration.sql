-- Cash pre-registration: the buyer registers online, gets the QR by email and pays cash at the door.
-- Additive only: new enum values and a flag that defaults to off, so existing events behave as before.

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_CASH';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_CASH';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allowCashPrereg" BOOLEAN NOT NULL DEFAULT false;
