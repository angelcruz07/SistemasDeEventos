-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_RECEIPT', 'PENDING_VALIDATION', 'PAID', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "seq" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "orderId" TEXT,
ALTER COLUMN "ticketId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "registrationEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_eventId_status_idx" ON "Order"("eventId", "status");

-- CreateIndex
CREATE INDEX "Order_eventId_email_idx" ON "Order"("eventId", "email");

-- CreateIndex
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

-- CreateIndex
CREATE INDEX "Receipt_orderId_uploadedAt_idx" ON "Receipt"("orderId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill (idempotent, safe to re-run): every legacy ticket becomes a 1:1 order.
-- Order.id = Ticket.id and Order.code = Ticket.code so emailed links and SPEI concepts stay valid.
INSERT INTO "Order" (
    "id", "eventId", "code", "name", "email", "answers", "quantity", "unitPriceCents", "amountCents",
    "currency", "paymentMethod", "status", "rejectionReason", "reviewedAt", "registrationEmailSentAt",
    "createdAt", "updatedAt"
)
SELECT
    t."id", t."eventId", t."code", t."name", t."email", t."answers", 1, t."amountCents", t."amountCents",
    t."currency", t."paymentMethod",
    (CASE t."status"::text WHEN 'CHECKED_IN' THEN 'PAID' ELSE t."status"::text END)::"OrderStatus",
    t."rejectionReason", t."reviewedAt", t."registrationEmailSentAt",
    t."createdAt", t."updatedAt"
FROM "Ticket" t
WHERE t."orderId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "Ticket" t SET "orderId" = t."id"
WHERE t."orderId" IS NULL
  AND EXISTS (SELECT 1 FROM "Order" o WHERE o."id" = t."id");

UPDATE "Receipt" r SET "orderId" = r."ticketId"
WHERE r."orderId" IS NULL
  AND r."ticketId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Order" o WHERE o."id" = r."ticketId");
