-- Rollback helper for the group-purchase expand phase.
-- USE ONLY BEFORE the contract migration (20261013120000_orders_contract) is applied. After it,
-- Receipt.ticketId and Ticket_eventId_email_key no longer exist and this script fails:
-- rollback is forward-fix only from that point on.
-- Run after reverting the application code to the pre-order version.
-- Idempotent: safe to run more than once. Nothing is dropped.
--
-- 1. Every order without tickets (created by the order-aware code) gets one mirror
--    ticket with Ticket.id = Order.id and Ticket.code = Order.code, so old links work.
-- 2. Receipts without a ticket are pointed back at their order's first ticket (lowest seq),
--    which covers receipts of multi-ticket orders too.
--
-- Limits: only ONE mirror ticket is created per order (the old code is single-ticket), and the
-- old code only shows tickets, so extra tickets of a multi-ticket order need manual review.
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

UPDATE "Receipt" r SET "ticketId" = first_ticket."id"
FROM (
  SELECT DISTINCT ON (t."orderId") t."orderId", t."id"
  FROM "Ticket" t
  ORDER BY t."orderId", t."seq" ASC, t."createdAt" ASC
) AS first_ticket
WHERE r."ticketId" IS NULL
  AND r."orderId" = first_ticket."orderId";

COMMIT;

-- Orders that still have no ticket (skipped above) and need manual review. Their receipts keep
-- a NULL ticketId and are invisible to the old code until a ticket exists:
-- SELECT o."id", o."eventId", o."email", o."status" FROM "Order" o
-- WHERE NOT EXISTS (SELECT 1 FROM "Ticket" t WHERE t."orderId" = o."id");
