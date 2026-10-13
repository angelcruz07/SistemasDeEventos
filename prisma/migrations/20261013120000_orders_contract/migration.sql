-- orders_contract: finishes the group-purchase migration. Rollback is forward-fix only after this.
-- Everything runs inside the migration transaction, so a failure leaves the schema untouched.
-- Deploy only after the order-aware code (PR2) is live: see README.md.

-- 1. Re-run the idempotent expand backfill for rows written by pre-order code since the expand.
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

UPDATE "Receipt" r SET "orderId" = t."orderId"
FROM "Ticket" t
WHERE r."orderId" IS NULL
  AND r."ticketId" = t."id"
  AND t."orderId" IS NOT NULL;

-- 2. Drift sync: the old deployed code kept changing tickets only. For quantity-1 orders whose
--    mirror ticket (Ticket.id = Order.id) disagrees, the ticket is the truth (CHECKED_IN -> PAID).
UPDATE "Order" o SET
    "status" = (CASE t."status"::text WHEN 'CHECKED_IN' THEN 'PAID' ELSE t."status"::text END)::"OrderStatus",
    "rejectionReason" = t."rejectionReason",
    "reviewedAt" = t."reviewedAt",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Ticket" t
WHERE t."id" = o."id"
  AND t."orderId" = o."id"
  AND o."quantity" = 1
  AND (
    o."status"::text <> CASE t."status"::text WHEN 'CHECKED_IN' THEN 'PAID' ELSE t."status"::text END
    OR o."rejectionReason" IS DISTINCT FROM t."rejectionReason"
    OR o."reviewedAt" IS DISTINCT FROM t."reviewedAt"
  );

-- 3. Contract.
-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_ticketId_fkey";

-- DropIndex
DROP INDEX "Ticket_eventId_email_key";

-- DropIndex
DROP INDEX "Receipt_ticketId_uploadedAt_idx";

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "orderId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "ticketId",
ALTER COLUMN "orderId" SET NOT NULL;
