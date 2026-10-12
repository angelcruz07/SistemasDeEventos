# Apply progress: group-purchase

## Batch 1 — PR1 "Expand schema + domain core" (branch feat/group-purchase-pr1-schema)
- [x] 1.1 schema: OrderStatus, Order, Ticket.orderId/seq, Receipt.orderId + optional ticketId; @@unique([eventId,email]) kept
- [x] 1.2 migration 20261012120000_orders_expand (migrate diff + idempotent backfill + README parity checks); deployed to the testing DB
- [x] 1.3 lib/ticketing/order.ts (TDD)
- [x] 1.4 hasRoom + decideReceiptUpload quantity (TDD)
- [x] 1.5 sign/verifyOrderToken (TDD)
- [x] 1.6 scripts/rollback-orders.sql (validated in a rolled-back tx)

DB: before 8 tickets (6 CHECKED_IN, 2 PENDING_RECEIPT), 7 receipts. After: 8 orders (6 PAID, 2 PENDING_RECEIPT); 0 tickets/receipts without orderId; orders = tickets; 0 amount/status mismatches; backfill re-run = INSERT 0 / UPDATE 0 / UPDATE 0.

Decision: REJECTED counts as OPEN for dedupe (design D6 updated).
Deviation: lib/server/receipts-purge.ts filters ticketId null (type fix, behavior unchanged).
Known gap: backfill does not re-sync order status when old code changes a ticket after the expand; PR3 re-run only catches new tickets.
Next: PR2 (order-aware write path).
