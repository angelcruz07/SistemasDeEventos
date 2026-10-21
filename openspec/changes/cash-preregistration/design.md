# Design: Cash pre-registration (addendum to `group-purchase`)

## Goal

A buyer registers online choosing **"Efectivo en la entrada"**, gets an email with one QR per ticket, and pays cash at the door. Door staff scan the QR, collect the order amount and let the attendee in with one tap.

## Decisions

| # | Decision | Rejected alternative | Rationale |
|---|----------|----------------------|-----------|
| C1 | New `Event.allowCashPrereg` flag, separate from `allowCash` | Reuse `allowCash` | `allowCash` is documented as door-only and "never public"; reusing it would silently open public registration on existing events. |
| C2 | New status `PENDING_CASH` in both `OrderStatus` and `TicketStatus` | Reuse `PENDING_RECEIPT` with method CASH | Every screen (order page, ticket page, door, dashboard) must behave differently from SPEI: no receipt upload, the QR is shown, the door collects. |
| C3 | Tickets are created at registration time with status `PENDING_CASH` (exception to D3) | Issue tickets only when paid | The QR has to exist before the payment, because the door collects against it. `PENDING_CASH` is NOT a pre-issue status: the ticket page shows the QR instead of redirecting. |
| C4 | Spots: each `PENDING_CASH` ticket holds one (`SPOT_TICKET_STATUSES`) | Do not hold until paid | Otherwise the event could be oversold at the door. The organizer frees no-shows by cancelling the order. |
| C5 | `PENDING_CASH` orders are OPEN (`isOpenOrder`) | — | Same dedupe as SPEI: a repeated email re-sends the pre-registration email instead of creating a second order; a walk-in with that email is refused. |
| C6 | Door action `collectCashAndCheckIn`: under the event lock, order `PENDING_CASH → PAID` (`paidAt = now`), all its tickets `PENDING_CASH → PAID`, the scanned one `→ CHECKED_IN` | Collect per ticket | Money is per order. The rest of a group enters by scanning their own QR (now PAID). `paidAt` puts the money in the cash-up under CASH. |
| C7 | The door view gets the amount to collect only through `CheckInDecision.collect` | Add `amountCents` to `DoorTicketView` | Keeps the door projection a whitelist; staff need the amount only for this decision. |
| C8 | Cancelling a cash ticket from the list cancels its whole order | Ticket-level cancel | The amount due belongs to the order; a partial cancel would make the door charge the wrong amount. |

## Flow

```
Buyer -> registerForEvent(slug, { ..., paymentMethod: "CASH" })
  tx: lock event -> decideOrder(method CASH) -> Order(PENDING_CASH, CASH) + N Ticket(PENDING_CASH)
  after(): sendCashPreregistrationEmail (amount + one QR per ticket)

Door -> lookupTicket / searchTickets -> checkInDecision = collect("Cobrar $X en efectivo (N boletos)")
     -> collectCashAndCheckIn(key, ticketId)
  tx: lock event; Order PENDING_CASH->PAID (paidAt); Tickets PENDING_CASH->PAID; scanned PAID->CHECKED_IN
```

## Migration

`20261021120000_cash_preregistration`: additive (two enum values, one boolean defaulting to false). Existing events are unchanged until the organizer turns the option on in "Boletos y pagos".
