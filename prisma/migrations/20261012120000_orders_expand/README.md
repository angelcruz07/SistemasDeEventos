# orders_expand

Expand-only migration for group purchase. Nothing is dropped; `Ticket_eventId_email_key` is kept so the
currently deployed code keeps working. The backfill at the end of `migration.sql` is idempotent
(`ON CONFLICT DO NOTHING`, `WHERE "orderId" IS NULL`) and is re-run in the contract migration.

## Parity checks (all must return 0 / true)

```sql
-- tickets without an order
SELECT count(*) FROM "Ticket" WHERE "orderId" IS NULL;
-- receipts without an order
SELECT count(*) FROM "Receipt" WHERE "orderId" IS NULL;
-- order count equals ticket count (before the new write path is deployed)
SELECT (SELECT count(*) FROM "Order") = (SELECT count(*) FROM "Ticket") AS counts_match;
-- amount or status mismatch between a ticket and its mirror order
SELECT count(*) FROM "Ticket" t JOIN "Order" o ON o."id" = t."orderId"
WHERE o."amountCents" <> t."amountCents" OR o."unitPriceCents" <> t."amountCents" OR o."quantity" <> 1
   OR o."status"::text <> CASE t."status"::text WHEN 'CHECKED_IN' THEN 'PAID' ELSE t."status"::text END;
```

Rollback before the contract step: revert the code; for orders without tickets run `scripts/rollback-orders.sql`.
