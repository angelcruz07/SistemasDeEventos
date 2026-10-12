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

## Batch 2 - PR2 "Order-aware write path, quantity fixed at 1" (branch feat/group-purchase-pr2-write-path)
- [x] 2.1 lib/server/held.ts countHeld (D5) + pure heldTotal (TDD). Used by registration, upload, getEventBySlug. Dashboard stats are unchanged on purpose: they count tickets by status and every quantity-1 order has a mirror ticket, so nothing double counts.
- [x] 2.2 registration.actions.ts creates an Order; dedupe by OPEN order under the lock; `eventId_email` lookup now only resolves legacy tickets.
- [x] 2.3 shared core lives in lib/server/order-receipt.ts (Next route files cannot export helpers); app/api/orders/[token]/receipt/route.ts and the ticket route are thin adapters.
- [x] 2.4 review.actions.ts: approve/reject/cancel/resendOrder; ticket-id actions resolve to the order; ticket-level cancel of a PAID ticket stays.
- [x] 2.5 sendOrderEmail + pure buildOrderEmail (TDD); sendTicketEmail is now ticket-only.
- [x] 2.6 door walk-in creates Order(CASH, PAID) + CHECKED_IN ticket in one tx; purge groups by orderId (pre-order receipts by ticketId) and expired-event purge also goes through order.event; /api/receipts/[id] authorizes through order or ticket.
- [x] Carry-over: purge branch (a) covers orderId-only receipts; no code path deletes an Order or Ticket.

Design decisions / deviations (PR2 only):
- Mirror ticket (deviation from D3). A quantity-1 order is created together with ONE ticket that has the SAME id and code as the order (exactly the shape the backfill produces), in the pre-issue status. Reason: the current attendees list, CSV, cash-up, dashboard and receipt dialog are all ticket-centric; without the mirror, new pending orders would be invisible to the organizer until PR5. Approval flips the mirror to PAID via planIssuance(1,1) = flip 1 / create 0 (the create path exists for orders without a mirror). PR4 must stop creating the mirror when quantity > 1.
- Receipts are dual-linked (orderId + mirror ticketId) so the existing list reads them and a code rollback still finds them.
- Legacy orderless tickets (written by the old deployed code after the backfill): ensureOrderForTicket (lib/server/orders.ts) creates Order.id = Ticket.id, code, status (CHECKED_IN -> PAID), amount, quantity 1, then links ticket and receipts. Idempotent (createMany skipDuplicates + conditional updateMany), always called under the Event FOR UPDATE lock, from: registration (ticket found by email), receipt upload (ticket token), review actions (ticket id). countHeld also counts orderless PENDING_VALIDATION tickets so capacity stays correct before they are resolved.
- Emailed links keep working with no new page: the ticket page already resolves the ticket by id. Order id == mirror ticket id, so the "received"/"rejected" email link is /ticket/{signTicketToken(order.id)}; it is the upload page while unpaid and turns into the ticket after approval. Old links already emailed are unchanged. /order/[token] arrives in PR4.
- A buyer with a PAID/CANCELLED order who registers again with the same email gets "Ya tienes un boleto con este correo." (legacy unique). This replaces the old silent re-send of the ticket link for PAID buyers; PR3 removes the unique.
- decideRegistration/RegistrationDecision in registration.ts are now unused by the action (kept with tests; remove in PR3).
Known gaps: legacy order drift (old code changing a ticket after the backfill while its order exists) still PR3. Creating N>1 tickets with the same email violates the legacy unique, so quantity>1 must wait for PR3.
