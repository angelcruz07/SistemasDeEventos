-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- Backfill (additive): orders currently PAID were paid when reviewed (or last touched).
UPDATE "Order" SET "paidAt" = COALESCE("reviewedAt", "updatedAt") WHERE "status" = 'PAID' AND "paidAt" IS NULL;

-- Backfill: CANCELLED orders that clearly were paid before being cancelled: a checked-in ticket,
-- an issued ticket that is not the order mirror (id <> order id), or a door walk-in (CASH, no email).
UPDATE "Order" o SET "paidAt" = COALESCE(o."reviewedAt", o."updatedAt")
WHERE o."status" = 'CANCELLED' AND o."paidAt" IS NULL
  AND (
    (o."paymentMethod" = 'CASH' AND o."email" IS NULL)
    OR EXISTS (SELECT 1 FROM "Ticket" t WHERE t."orderId" = o."id" AND (t."status" = 'CHECKED_IN' OR t."id" <> o."id"))
  );
