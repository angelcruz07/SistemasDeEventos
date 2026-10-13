# Design: Group Purchase (addendum to `event-ticketing-spei`)

## Technical Approach

Introduce an `Order` (purchase) aggregate that owns the buyer, quantity, money, payment status and receipts. A `Ticket` becomes a pure admission right (one QR, single use at the door) that belongs to an order. Rollout is expand/contract so the live app keeps working between `migrate deploy` and the Vercel deploy. Existing tickets are backfilled 1:1 into orders with `Order.id = Ticket.id` and `Order.code = Ticket.code`, so the SPEI concepts and links already emailed stay valid.

## Architecture Decisions

| # | Decision | Rejected alternative | Rationale |
|---|----------|----------------------|-----------|
| D1 | New `Order` model owns name/email/answers/quantity/unitPriceCents/amountCents/paymentMethod/status/rejectionReason/receipts. `Ticket.orderId` + `Ticket.seq` (1..N) | `quantity`/`groupId` on Ticket | One receipt and one review per purchase is the core rule. With a groupId, the payment status and receipts would be copied across N rows and every transition would have to touch all of them, which drifts. |
| D2 | Separate `OrderStatus` enum (`PENDING_RECEIPT, PENDING_VALIDATION, PAID, REJECTED, CANCELLED`). Ticket keeps `TicketStatus` | Reuse `TicketStatus` for orders | `CHECKED_IN` is meaningless on a purchase of 3. Check-in stays per ticket. |
| D3 | Tickets are issued only when the order becomes PAID (on approval, or at creation for free events). New orders have zero tickets before that | Create N tickets up front that mirror the order status | Avoids burning codes on abandoned orders and keeps a single source of truth. |
| D4 | Legacy "pre-issue" tickets (status PENDING_RECEIPT/PENDING_VALIDATION/REJECTED) mirror their order. Every order transition runs `ticket.updateMany({ orderId, status in PRE_ISSUE })` in the same tx. Approval flips k pre-issue tickets to PAID and creates `quantity - k` new ones | Delete or rewrite legacy pending tickets | No data loss, and old ticket ids and tokens survive. For new orders the sync is a no-op. |
| D5 | Capacity held = `SUM(order.quantity WHERE status = PENDING_VALIDATION)` + `COUNT(ticket WHERE status IN (PAID, CHECKED_IN))`, under the existing `Event FOR UPDATE` lock. `hasRoom(held, qty, cap) = cap === null \|\| held + qty <= cap` | Sum quantities of PAID orders | Counting issued tickets lets an individually cancelled ticket free its spot. Legacy pre-issue tickets are counted only through their order. |
| D6 | Dedupe: at most one OPEN order (PENDING_RECEIPT/PENDING_VALIDATION/REJECTED) per (event, email); REJECTED counts as open (organizer decision: the buyer re-uploads on the same order instead of registering again), checked under the Event lock. A duplicate re-sends that order's link and ignores the new quantity. A buyer with a PAID order may buy again. `@@unique([eventId,email])` on Ticket is dropped in the contract step | Partial unique index | Prisma does not model partial indexes, so later `migrate diff` runs would try to drop it. The event lock already serializes registrations (existing pattern). |
| D7 | New buyer page `/order/[token]` (token purpose `order:v1:`) for payment instructions, upload, review state and, once PAID, the list of N ticket links. `/ticket/[token]` shows its own QR. A legacy ticket that is not issued yet redirects to its order page | A single page for both | Keeps the payment and admission concerns apart. Old links keep working through the redirect. |
| D8 | Quantity: an integer ≥ 1. Without a capacity, max 50. With a capacity, max is the remaining room, checked under the lock at registration and again at upload. `amountCents = unitPriceCents × qty` must be ≤ 2^31−1. A refusal never reveals a number | Expose remaining spots | Capacity is internal and never public. |
| D9 | N ticket emails go through a new `EmailSender.sendBatch` (Resend batch endpoint, ≤100 per call; the console sender loops) inside `after()`. `ticketEmailSentAt` is set per ticket on success | Sequential sends with a delay | Resend's default limit is about 2 req/s. 50 sequential sends with a delay put `after()` at risk of hitting the function `maxDuration`. |
| D10 | Door walk-in = `Order(qty 1, CASH, PAID)` + 1 `Ticket(CHECKED_IN)` in one tx. A duplicate email is refused when an OPEN or PAID order exists | Tickets without an order | Keeps `Ticket.orderId` NOT NULL and the cash-up uniform. |
| D11 | Cancelling an order NEVER refunds (organizer decision). New `Order.paidAt` (set once when the order becomes PAID: approval, free registration, door walk-in; never cleared). Cash-up money = sum of `amountCents` of orders with `paidAt != null`, any status, by method; counts stay ticket-based. Cancel makes issued tickets CANCELLED (checked-in stay CHECKED_IN); the cancel confirm warns that money is not refunded. A never-paid cancelled order hides its mirror ticket in views and CSV | Subtract cancelled orders from the cash-up (needs a refund workflow the product does not have) | Money already collected must not vanish from the door cash-up; `status = PAID` alone cannot tell a paid-then-cancelled order from a never-paid one. Migration `20261014120000_order_paid_at` is additive with a backfill |

## Data Flow (approval)

```
Organizer -> approveOrder(eventId, orderId)
  tx: SELECT Event FOR UPDATE
      updateMany Order {id, eventId, status: PENDING_VALIDATION} -> PAID   (count != 1 -> STALE)
      k = updateMany Ticket {orderId, status in PRE_ISSUE} -> PAID
      createMany Ticket x (quantity - k), codes pre-generated, seq k+1..N
      (P2002 on code -> whole tx retried by createWithUniqueCode)
  after(): sendBatch(N ticket emails, one /ticket/{token} each) -> set ticketEmailSentAt
```

Receipt upload: `/api/orders/[token]/receipt` → lock → `decideReceiptUpload({status, event, held, quantity})` → `Receipt(orderId)` → conditional order update (+ pre-issue sync). `/api/tickets/[token]/receipt` stays as an adapter (ticket → orderId → shared core) for browser tabs that are already open.

## Schema (target after contract)

```prisma
enum OrderStatus { PENDING_RECEIPT PENDING_VALIDATION PAID REJECTED CANCELLED }
model Order {
  id String @id @default(uuid())  eventId String  code String @unique
  name String  email String?  answers Json @default("{}")
  quantity Int  unitPriceCents Int  amountCents Int  currency String @default("MXN")
  paymentMethod PaymentMethod  status OrderStatus
  rejectionReason String?  reviewedAt DateTime?  registrationEmailSentAt DateTime?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  event Event @relation(...)  tickets Ticket[]  receipts Receipt[]
  @@index([eventId, status])  @@index([eventId, email])
}
// Ticket: + orderId String (FK cascade), + seq Int @default(1), - @@unique([eventId,email]), + @@index([orderId])
// Ticket keeps name/email/answers as an immutable snapshot copied from the order (door search/view unchanged)
// Receipt: ticketId -> orderId
```

## Migration / Rollout

1. **Expand** (`migrate diff` script plus hand-appended backfill): create the `Order` table and enum. Add nullable `Ticket.orderId` and `seq DEFAULT 1`, nullable `Receipt.orderId`, and drop NOT NULL on `Receipt.ticketId`. Backfill:
   - `INSERT INTO "Order" SELECT t.id, … quantity 1, unit=amount, status = CASE CHECKED_IN→PAID ELSE status FROM "Ticket" t WHERE "orderId" IS NULL`
   - `UPDATE "Ticket" SET "orderId"=id WHERE "orderId" IS NULL`
   - `UPDATE "Receipt" SET "orderId"="ticketId" WHERE "orderId" IS NULL`

   The backfill is idempotent. Old code keeps running.
2. Deploy the order-aware write path (quantity is still fixed at 1).
3. **Contract**: re-run the backfill for stragglers, set `orderId` NOT NULL on Ticket and Receipt, drop `Ticket_eventId_email_key` and `Receipt.ticketId`.
4. Enable quantity > 1 in the UI.

Verify each step with row-count parity queries (`orders == tickets` before step 2; no NULL `orderId`).

**Rollback**:
- Before step 3: revert the code. Orders created by the new code that have no tickets need `scripts/rollback-orders.sql` (insert one mirror ticket per ticketless order and point the receipts back).
- After step 3: forward-fix only, because re-adding the email unique fails once group or repeat purchases exist.

## File Changes

| File | Action |
|------|--------|
| `prisma/schema.prisma`, `prisma/migrations/*_orders_expand`, `*_orders_contract` | Modify/Create |
| `lib/ticketing/order.ts` (+test): `parseQuantity`, `maxQuantity`, `orderAmount`, `decideOrder`, `isOpenOrder`, `planIssuance`, `ORDER_TRANSITIONS` | Create |
| `lib/ticketing/{capacity,receipt-upload,registration,review,cash-up,csv,attendees,status}.ts` | Modify: quantity-aware, order statuses |
| `lib/server/held.ts` | Create: `countHeld(tx, eventId)` (D5), used by registration, upload, `event.actions.ts` capacity edit, dashboard |
| `lib/ticketing/token.ts` | Modify: `sign/verifyOrderToken` |
| `app/event/[slug]/_actions/registration.actions.ts` + form component | Modify: quantity, live total |
| `app/api/orders/[token]/receipt/route.ts`, `app/order/[token]/page.tsx` | Create |
| `app/api/tickets/[token]/receipt/route.ts`, `app/ticket/[token]/page.tsx` | Modify: adapter / redirect, "Boleto n de N" |
| `app/dashboard/events/[id]/_actions/review.actions.ts` | Modify: `approve/reject/cancel/resendOrder`; ticket-level cancel kept |
| `app/dashboard/events/[id]/attendees/{page,export/route}.tsx`, `AttendeesTable`, `ReceiptDialog` | Modify: order rows with expandable tickets |
| `lib/server/ticket-email.ts`, `lib/email/{templates,email-sender,resend-sender}.ts` | Modify: order "received" email (order amount, order code, order link), `sendBatch` |
| `lib/server/receipts-purge.ts`, `lib/ticketing/receipt-purge.ts` | Modify: superseded receipts grouped by `orderId` |
| `app/door/[key]/_actions/door.actions.ts` | Modify: walk-in creates an order. Check-in unchanged |

## Interfaces

```ts
type OrderDecision =
  | { kind: "duplicate"; orderId: string }
  | { kind: "refused"; reason: "closed" | "full" | "quantity" }
  | { kind: "create"; status: OrderStatus; method: PaymentMethod; amountCents: number; issueNow: number };
function planIssuance(quantity: number, preIssue: number): { flip: number; create: number };
```

## Testing Strategy (Strict TDD)

| Layer | What |
|-------|------|
| Unit | `parseQuantity` (non-int, 0, 51 without capacity, string input), `decideOrder` (open dup, PAID re-buy, cap exactly reached, cap lowered below held, overflow), `decideReceiptUpload` with qty, `planIssuance`, `computeCashUp` (money from orders, counts from tickets), CSV per-ticket rows with unit amount + order code, attendee where with ticket-code search, token purpose separation (ticket token ≠ order token) |
| Integration (manual/scripted on a DB copy) | Backfill parity, approve-twice race, legacy pending link → redirect → upload → approve |

## Open Questions

- [x] Should a REJECTED order count as OPEN for dedupe? Resolved by the organizer: YES. OPEN = PENDING_RECEIPT | PENDING_VALIDATION | REJECTED (see D6 and `isOpenOrder`).
- [ ] Partially cancelled PAID order: the cash-up still counts the full order amount (no refunds are modeled). Is this acceptable?
