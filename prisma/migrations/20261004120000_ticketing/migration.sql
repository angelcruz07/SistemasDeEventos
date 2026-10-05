-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING_RECEIPT', 'PENDING_VALIDATION', 'PAID', 'CHECKED_IN', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('SPEI', 'CASH', 'FREE');

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Confirmation" DROP CONSTRAINT "Confirmation_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Confirmation" DROP CONSTRAINT "Confirmation_attendanceId_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allowCash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowSpei" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MXN',
ADD COLUMN     "displayCapacity" INTEGER,
ADD COLUMN     "formSchema" JSONB NOT NULL DEFAULT '{"version":1,"fields":[]}',
ADD COLUMN     "priceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "speiBank" TEXT,
ADD COLUMN     "speiBeneficiary" TEXT,
ADD COLUMN     "speiClabe" TEXT;

-- DropTable
DROP TABLE "Attendance";

-- DropTable
DROP TABLE "Confirmation";

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "status" "TicketStatus" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "registrationEmailSentAt" TIMESTAMP(3),
    "ticketEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "bytes" BYTEA,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_eventId_email_key" ON "Ticket"("eventId", "email");

-- CreateIndex
CREATE INDEX "Receipt_ticketId_uploadedAt_idx" ON "Receipt"("ticketId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

