-- Rollback helper for the group-purchase expand phase (use BEFORE the contract migration).
-- Run after reverting the application code to the pre-order version.
-- Idempotent: safe to run more than once. Nothing is dropped.
--
-- 1. Every order without tickets (created by the order-aware code) gets one mirror
--    ticket with Ticket.id = Order.id and Ticket.code = Order.code, so old links work.
-- 2. Receipts that only point at an order are pointed back at the mirror ticket.
--
-- Limits: only ONE mirror ticket is created per order (the old code is single-ticket).
-- Orders whose (eventId, email) already has a ticket are skipped (the old unique index
-- ("Ticket_eventId_email_key") would reject them); review those by hand with the
-- query at the bottom.

BEGIN;

INSERT INTO "Ticket" (
    "id", "eventId", "orderId", "seq", "code", "name", "email", "answers", "status",
    "paymentMethod", "amountCents", "currency", "rejectionReason", "reviewedAt",
    "registrationEmailSentAt", "createdAt", "updatedAt"
)
SELECT
    o."id", o."eventId", o."id", 1, o."code", o."name", o."email", o."answers",
    o."status"::text::"TicketStatus",
    o."paymentMethod", o."unitPriceCents", o."currency", o."rejectionReason", o."reviewedAt",
    o."registrationEmailSentAt", o."createdAt", o."updatedAt"
FROM "Order" o
WHERE NOT EXISTS (SELECT 1 FROM "Ticket" t WHERE t."orderId" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "Ticket" t WHERE t."id" = o."id")
  AND (
    o."email" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "Ticket" t WHERE t."eventId" = o."eventId" AND t."email" = o."email"
    )
  )
ON CONFLICT DO NOTHING;

UPDATE "Receipt" r SET "ticketId" = r."orderId"
WHERE r."ticketId" IS NULL
  AND r."orderId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Ticket" t WHERE t."id" = r."orderId");

COMMIT;

-- Orders that still have no ticket (skipped above) and need manual review:
-- SELECT o."id", o."eventId", o."email", o."status" FROM "Order" o
-- WHERE NOT EXISTS (SELECT 1 FROM "Ticket" t WHERE t."orderId" = o."id");
