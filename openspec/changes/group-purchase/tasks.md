# Tasks: Group Purchase

Strict TDD: every pure function goes RED → GREEN → REFACTOR before it is wired in. Deploy order matters (see design "Migration / Rollout").

Decision needed before apply: No
Chained PRs recommended: Yes
400-line budget risk: Medium

## PR1 — Expand schema + domain core (~250 non-test lines)
- [x] 1.1 `prisma/schema.prisma`: add `OrderStatus` and `Order`, nullable `Ticket.orderId`, `Ticket.seq @default(1)`, nullable `Receipt.orderId`, optional `Receipt.ticketId`. Keep `@@unique([eventId,email])`.
- [x] 1.2 Expand migration via `prisma migrate diff --script` plus a hand-appended idempotent backfill (`Order.id = Ticket.id`, `code` = ticket code, CHECKED_IN→PAID). Add parity check queries to the migration README.
- [x] 1.3 TDD `lib/ticketing/order.ts`: `parseQuantity`, `maxQuantity`, `orderAmount` (overflow guard), `decideOrder`, `isOpenOrder`, `planIssuance`, order transitions.
- [x] 1.4 TDD quantity-aware `hasRoom` in `capacity.ts` and `decideReceiptUpload` (quantity input).
- [x] 1.5 TDD `sign/verifyOrderToken` (purpose `order:v1:`, not interchangeable with ticket tokens).
- [x] 1.6 Write `scripts/rollback-orders.sql` (mirror ticket per ticketless order, receipts back to ticketId).
Verify: `migrate deploy` on a DB copy, parity check, app unchanged.

## PR2 — Order-aware write path, quantity fixed at 1 (~400)
- [x] 2.1 `lib/server/held.ts` `countHeld` (D5). Use it in registration, upload, `event.actions.ts`, dashboard counts.
- [x] 2.2 `registration.actions.ts`: create an Order (free → PAID + tickets in the same tx). Dedupe by open order under the lock. Stop using `eventId_email`.
- [x] 2.3 `app/api/orders/[token]/receipt/route.ts` shared core. Turn `app/api/tickets/[token]/receipt` into an adapter.
- [x] 2.4 `review.actions.ts`: `approveOrder` (lock, conditional update, `planIssuance`, `createMany` with retry), `rejectOrder`, `cancelOrder`, `resendOrder`. The old ticket-id actions resolve to the order (UI unchanged). Keep ticket-level cancel.
- [x] 2.5 `ticket-email.ts`: the order "received" email uses the order amount, order code and `/order/[token]`. Ticket emails are per ticket.
- [x] 2.6 Door walk-in creates Order + Ticket. Receipt purge groups by `orderId`.
Verify: full suite + manual run on a DB copy (legacy pending link → upload → approve).

## PR3 — Contract migration (~60), deploy right after PR2
- [x] 3.1 Re-run the backfill. Set `orderId` NOT NULL (Ticket, Receipt). Drop `Ticket_eventId_email_key` and `Receipt.ticketId`. Update the schema. (migration 20261013120000_orders_contract generated, NOT applied yet)
Verify: no NULL `orderId`. Rollback is forward-fix only from here.

## PR4 — Buyer UI + quantity on (~350)
- [x] 4.1 Public form: quantity input with a live total (`priceCents × qty`). Server validation via `parseQuantity`/`decideOrder`.
- [x] 4.2 `app/order/[token]/page.tsx`: SPEI instructions (order amount, order code as concept), upload, review state, PAID → list of N ticket links.
- [x] 4.3 `/ticket/[token]`: redirect a not-yet-issued legacy ticket to its order page. Show "Boleto n de N".
- [x] 4.4 TDD `EmailSender.sendBatch` (Resend batch ≤100 per call, chunked; the console sender loops). The approval sends N emails in `after()`.

## PR5 — Organizer views (~400)
- [x] 5.1 Attendees page: order rows (buyer, code, quantity, amount, status, receipt, actions) with expandable tickets. Status filter on the order. Search also matches ticket codes.
- [x] 5.2 TDD `computeCashUp`: money from PAID orders, counts from PAID/CHECKED_IN tickets.
- [x] 5.3 TDD CSV: one row per ticket (order code, n/N, unit amount), plus one row per order that has no tickets yet.

## Carry-over from PR1 review (must address)
- [x] PR2: receipt purge branch (a) must also cover receipts linked only by `orderId` (expired events), not just `ticket.event`.
- [x] PR2: cancel must never hard-delete an Order (FKs cascade to tickets and receipts).
- [x] PR3 (migration NOT applied yet): the backfill re-run must also SYNC mutable fields of already-backfilled orders from their legacy ticket (status, rejectionReason, reviewedAt) via `ON CONFLICT (id) DO UPDATE` or a drift-sync UPDATE, because the old deployed code keeps changing tickets only. Run the README parity check before and after.
- [x] Rollback script (pre-contract only): receipts of multi-ticket orders stay with null `ticketId`; repoint them to the order's first ticket or list them for manual review.
