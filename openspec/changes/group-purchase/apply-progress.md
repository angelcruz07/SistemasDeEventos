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

## Batch 3 - PR3 "Contract migration" (branch feat/group-purchase-pr3-contract)
- [x] 3.1 migration prisma/migrations/20261013120000_orders_contract (backfill re-run, drift sync via UPDATE ... FROM, NOT NULL, drop Ticket_eventId_email_key, drop Receipt.ticketId) + README with pre/post checks and deploy order. NOT APPLIED to any DB.
- [x] Code: no use of Receipt.ticketId (upload, purge, receipt route, attendees); removed ensureOrderForTicket, legacyOrderFromTicket, resolveExistingOrder, orphanPendingTickets in heldTotal, receiptGroupKey (orderless tickets are impossible after NOT NULL).
- [x] Registration dedupes by open order only; a buyer with a PAID/CANCELLED order creates a new one.
- [x] Door walk-in: blocksWalkIn (TDD) + check under lockEvent; refuses with the existing Spanish message when the email has an open or PAID order.
- [x] Cleanup: decideRegistration/RegistrationDecision and tests removed.
- [x] scripts/rollback-orders.sql: receipts repoint to the first ticket of the order; header says pre-contract only.
Read-only check on the testing DB before the migration: 3 tickets and 1 receipt without orderId; 1 drifted quantity-1 order (LGCY01: order PENDING_VALIDATION, ticket PAID); orders 11 vs tickets 14.
Gap: between applying the migration and deploying PR3 code, the PR2 deployment fails on receipt upload (writes ticketId) and the attendees list (reads Ticket.receipts). Keep the window short.

## Batch 4 - PR4 "Buyer UI + quantity on" (branch feat/group-purchase-pr4-buyer-ui)
- [x] 4.4 EmailSender.sendBatch: pure chunk/sendInChunks (TDD, 100 per call, aligned results, failed chunk isolated); ResendSender uses resend.batch.send (SDK 6.32.1 exposes it); ConsoleSender loops; sendEmails + sendTicketEmails record ticketEmailSentAt per ticket; approveOrder/resendOrder use one batch in after().
- [x] 4.2 /order/[token] page (orderViewFor TDD): SpeiInstructions with copy buttons using order amount and order code, ReceiptUpload (scope="orders"), review state, PAID ticket list "Boleto n de N" with /ticket links, cancelled view. Order emails (received, rejected) now link to /order/[token] for every quantity.
- [x] 4.3 /ticket/[token]: pre-issue tickets redirect to the order page (ticketRedirectsToOrder TDD); TicketCard shows "Boleto n de N" when the order has more than one ticket.
- [x] 4.1 Form: quantity stepper (hidden when purchaseLimit is 1), live total (clampQuantity/orderTotalLabel TDD). registerForEvent takes quantity (parseQuantity + decideOrder), one order; quantity 1 keeps the mirror ticket; quantity > 1 creates none until approval; free N creates N PAID tickets in the same tx and sends one batch. Quantity refusal text: "No hay lugares suficientes para esa cantidad."
Deviation/notes: purchaseLimit = max(1, min(room, 50)) is public (room only when it is under 50). The ticket page upload/review branches are now unreachable (redirect first) but kept as a defensive fallback. No schema change.
Needs DB/e2e: quantity 3 paid flow (register, upload on /order, approve, N emails, /order list), free N flow, legacy quantity-1 link redirect, event at capacity refusal.

## Batch 5 - PR5 "Organizer views" (branch feat/group-purchase-pr5-organizer-views)
- [x] 5.1 Attendees tab lists ORDERS (pure view-model lib/ticketing/attendee-rows.ts: toOrderRow, issuedTickets). Row: buyer, email, order code, quantity, amount, order status badge, method, date, latest receipt, actions (Revisar / Reenviar correo / Cancelar via approveOrder/rejectOrder/cancelOrder/resendOrder), expandable tickets ("n de N", status, Ingresó time/by, ticket-level cancel). Status filter + status tiles are ORDER statuses (ORDER_STATUS_LABELS). Search: name, email, order code, any ticket code (normalized). ReceiptDialog shows quantity and total to verify against the receipt. Receipt bytes are never selected.
- [x] 5.2 computeCashUp(orders, tickets) (TDD): money = PAID orders by method (FREE adds 0), counts = PAID/CHECKED_IN tickets; partially cancelled paid orders keep their full amount (note in CashUpSummary: no refunds).
- [x] 5.3 CSV (TDD): one row per issued ticket + one ticket-less row per order without issued tickets. Columns: Orden, Boleto, Boleto n de N, Nombre, Email, Estado de la orden, Estado del boleto, Método de pago, Monto del boleto (unit), Total de la orden (ONLY on the first row of each order so the column sums without double counting), Registrado (order createdAt), Ingresó, Registró en puerta, form fields, Otras respuestas (order answers repeat on every row). BOM, CRLF, injection guard, filters kept; the 10k cap now applies to orders.
- [x] Dashboard: "Compras por validar" counts orders in PENDING_VALIDATION (pendingOrderCount); "Boletos pagados" still counts PAID+CHECKED_IN tickets. No revenue card exists, so none changed.
Decisions: pre-issue mirror tickets (D4) are bookkeeping and are hidden from the expandable list and the CSV (the unpaid order shows alone); a cancelled never-paid order keeps its cancelled mirror as one cancelled ticket row.
TDD: RED (14 failures across cash-up/csv/attendees/attendee-rows) then GREEN; suite 409 tests passing. No schema change.
Needs DB/e2e: attendees list with legacy qty-1 and qty-3 orders, expand tickets, Revisar approve/reject, cancel order and ticket, search by ticket code, status filter, CSV open in Excel, dashboard counts. Requires the PR3 migration applied.
