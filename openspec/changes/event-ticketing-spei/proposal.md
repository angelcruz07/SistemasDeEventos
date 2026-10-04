# Proposal: Event Ticketing with SPEI Validation and Door Check-in

## Intent

The app only supports RSVP (confirmed/maybe/declined). The organizer runs a paid real event on **2026-10-30** and needs: custom registration, SPEI payment with manual receipt validation, emailed signed QR tickets, and fast single-use check-in at the door (including cash walk-ins). Product decisions in `explore.md` are settled.

**Users**: organizer (configures, validates receipts, exports), attendee (registers, uploads receipt, receives ticket), door staff (link + PIN, scans/searches, checks in, registers cash walk-ins; never sees receipts, revenue, or settings).

## Scope

### Slice 0 - Prerequisites (immediate)
- Stop slug regeneration in `updateEvent`; allow editing past/today events.
- Vitest setup; `db:migrate` / `db:deploy` scripts.

### Slice 1 - Presale (target 2026-10-12)
- `Ticket` model replaces RSVP (`Attendance`, dead `Confirmation`); legacy data discarded.
- Event config: price, SPEI details, payment toggles, internal capacity, `registrationOpen`, public display number.
- Form builder (short text, long text, select, checkbox, number, phone); email mandatory, unique per event.
- Public registration; private receipt upload; approve/reject with reason; attendee list.
- Resend emails: registration received, rejected, ticket. Free events skip payment.
- Ticket page (no nav, one fixed design, signed QR) + share-event button.

### Slice 2 - Event day (target 2026-10-24)
- Door link + PIN; QR scanner + manual search; atomic single-use check-in.
- Walk-in cash registration (paid + checked_in, ignores cap).
- Ticket design editor (template, colors, logo, header); PDF download.
- Multi-image carousel; CSV export; cash-up summary by payment method.

Rehearsal ~2026-10-26.

### Out of Scope
- Payment gateways (Mercado Pago/Stripe) - payment stays behind a port.
- Multi-ticket purchases, staff accounts, Apple/Google Wallet, refunds.

## Capabilities

### New Capabilities
- `event-ticketing-config`: price, payment methods, SPEI details, capacity, registration toggle.
- `registration-form`: per-event form schema, edit locks, answer validation.
- `ticket-lifecycle`: statuses, dedupe, capacity counting, short code.
- `receipt-validation`: private upload, approve/reject.
- `ticket-delivery`: emails, ticket page, signed QR, share, PDF.
- `door-checkin`: door access, scan/search, check-in, walk-ins.
- `ticket-design`: organizer visual customization.
- `attendee-reporting`: list, filters, CSV, cash-up.
- `event-media`: multi-image carousel.

### Modified Capabilities
- None (no existing specs; RSVP behavior removed).

## Approach

- Prisma: `Ticket`, `Receipt` (bytea, private), `EventImage`; Event gains price (cents), payment/SPEI fields, `formSchema` JSON, `ticketDesign` JSON, `capacity`.
- Receipts: token-gated route handler (bypasses 1MB action limit), magic-byte check, 5MB, owner-only serving.
- QR: HMAC-SHA256 token (`node:crypto`, `timingSafeEqual`); check-in via `updateMany where status=paid`.
- Door: per-event hashed PIN, revocable; staff name stored as `checkedInBy`.
- Email: `sendEmail()` adapter over Resend; failures never block registration; `emailSentAt` + resend.
- Vitest covers token, short code, transitions, form schema, capacity.

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma`, `prisma/migrations/` | Modified |
| `app/dashboard/events/_actions/event.actions.ts` | Modified |
| `app/dashboard/events/_components/EventForm.tsx`, `EventAttendeesModal.tsx` | Modified/Replaced |
| `app/event/[slug]/` | Modified (form renderer, carousel, nav removed) |
| `app/ticket/[token]/`, `app/door/[eventId]/`, `app/api/receipts/` | New |
| `lib/` (tickets, email, form-schema) | New |
| `.env.template`, `package.json` | Modified |

## Review Workload Forecast

| Slice | Est. changed lines | Chained PRs recommended | 400-line budget risk |
|-------|-------------------|-------------------------|----------------------|
| 0 | ~250 | No | Low |
| 1 | ~2,800 | Yes (~6-7 PRs) | High |
| 2 | ~2,300 | Yes (~5-6 PRs) | High |

Decision needed before apply: Yes

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deadline | High | Strict slicing; Slice 2 extras droppable |
| Resend domain not verified | Med | Verify DNS now |
| Receipt/PII leak | Med | Private bytea, owner-only route |
| Double check-in/approval | Med | Atomic conditional updates |
| Scanner fails (HTTPS/camera) | Med | Manual search fallback |

## Rollback Plan

Each chained PR is revertable. Pre-launch, migrations can be reset (no production data). Post-launch, revert app code only; keep additive migrations. Door fallback: printed CSV.

## Dependencies

- Resend verified domain; `TICKET_SIGNING_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`.

## Success Criteria

- [ ] SPEI: register -> upload -> approve -> ticket email works end-to-end by 2026-10-12.
- [ ] Second scan reports "already checked in at HH:MM".
- [ ] Staff cannot access receipts, revenue, or settings.
- [ ] Rehearsal passes on two phones by 2026-10-26.

## Proposal question round

Completed during exploration; defaults accepted by organizer. Open for review: rejected-ticket spot release, receipt purge date.
