# orders_contract

Contract migration for group purchase. It re-runs the backfill, syncs drifted orders from their mirror
ticket, makes `Ticket.orderId` and `Receipt.orderId` NOT NULL, drops `Ticket_eventId_email_key` and
drops `Receipt.ticketId` (FK, index and column). Everything runs in one transaction.

**Rollback is forward-fix only after this migration.** `scripts/rollback-orders.sql` needs the
`Receipt.ticketId` column and the old unique index, so it only works BEFORE this migration.

## Deploy order (exact)

1. Push the PR2 code and wait until the Vercel deployment is READY (the old deployment writes
   `Receipt.ticketId` and relies on the email unique, so nothing older than PR2 may still be live).
2. Run the PRE checks below.
3. Apply this migration (`bun run db:deploy`).
4. Run the POST checks below.
5. Push the PR3 code (it no longer reads `Receipt.ticketId`, so it cannot run before step 3).

## Pre checks (informational: the migration repairs these)

```sql
SELECT count(*) FROM "Ticket" WHERE "orderId" IS NULL;   -- tickets written by old code
SELECT count(*) FROM "Receipt" WHERE "orderId" IS NULL;  -- receipts written by old code
-- drifted quantity-1 orders (the migration syncs them from the ticket)
SELECT o."code", o."status", t."status" AS ticket_status
FROM "Ticket" t JOIN "Order" o ON o."id" = t."orderId" AND o."id" = t."id"
WHERE o."quantity" = 1
  AND o."status"::text <> CASE t."status"::text WHEN 'CHECKED_IN' THEN 'PAID' ELSE t."status"::text END;
```

## Post checks (all must return 0)

```sql
SELECT count(*) FROM "Ticket" WHERE "orderId" IS NULL;   -- also enforced by NOT NULL
SELECT count(*) FROM "Receipt" WHERE "orderId" IS NULL;
SELECT count(*) FROM "Order" o JOIN "Ticket" t ON t."id" = o."id" AND t."orderId" = o."id"
WHERE o."quantity" = 1
  AND o."status"::text <> CASE t."status"::text WHEN 'CHECKED_IN' THEN 'PAID' ELSE t."status"::text END;
-- orders with quantity 1 that lost their ticket
SELECT count(*) FROM "Order" o WHERE o."quantity" = 1 AND o."status" = 'PAID'
  AND NOT EXISTS (SELECT 1 FROM "Ticket" t WHERE t."orderId" = o."id");
```
