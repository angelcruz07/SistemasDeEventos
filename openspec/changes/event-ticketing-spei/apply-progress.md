# Apply Progress: event-ticketing-spei

## Batch 1: PR0 (branch feat/ticketing-pr0-foundation) - DONE
- [x] 0.1 tree verified clean (only untracked .atl/, not committed)
- [x] 0.2 vitest@3.2.7 + vite-tsconfig-paths@5.1.4, vitest.config.mts
- [x] 0.3 scripts test, db:migrate, db:deploy, db:generate
- [x] 0.4 RED then GREEN formatMx (4 tests)
- [x] 0.5 updateEvent no longer regenerates slug
- [x] 0.6 updateEvent no longer rejects past date/time (createEvent keeps it)
- [x] 0.7 deleteEvent relies on cascade
- [x] 0.8 deleted 3 empty action files (no imports existed)

Verification: tsc clean; vitest 4/4; lint 5 problems (2 errors, 3 warnings) identical before/after, pre-existing.
Next: PR1 (not started).

## Batch 2: PR1 (branch feat/ticketing-pr1-schema) - DONE
- [x] 1.1 schema: enums, Event columns, Ticket, Receipt, RateLimitBucket; Attendance/Confirmation dropped (DoorAccess/EventImage deferred to PR7/PR11; Event.imageUrl kept)
- [x] 1.2 migration 20261004120000_ticketing. `migrate dev` refused (non-interactive; warns about dropping non-empty Attendance). Fallback used: `prisma migrate diff --from-schema <HEAD schema> --to-schema` -> migration.sql, applied with `bun run db:deploy`. No reset needed. migrate status: up to date.
- [x] 1.3 removed ConfirmAttendanceForm, EventAttendeesModal, confirmAttendance, getAttendancesForEvent, getEventBySlugWithAttendanceCount (public page uses getEventBySlug, form + count removed); dashboard stats now ticket counts by status (paid = PAID+CHECKED_IN, pending validation)
- [x] 1.4 EventCard "Boletos" link to /dashboard/events/[id]/ticketing; owner-protected stub page ("En construccion")
Verification: tsc clean; vitest 4/4; lint 3 problems (1 error EventsList set-state-in-effect pre-existing, 2 warnings); build OK.
Note: public /event/[slug] has no registration form until PR4.
Next: PR2 (not started).

## Batch 3: PR2 (branch feat/ticketing-pr2-domain) - DONE
- [x] 2.1 token (ticket + door session, purpose-separated HMAC, timingSafeEqual with length guard, injected `now` for expiry)
- [x] 2.2 short-code (injected randInt; CODE_ALPHABET 32 chars; `formatShortCode` -> 7K3-Q9M; `createWithUniqueCode` retries 5x)
- [x] 2.3 status (full transition matrix test; CHECKED_IN and CANCELLED are terminal; `initialStatus` throws on impossible method/channel combos)
- [x] 2.4 capacity (`HOLDING_STATUSES`, `countHeld`, `hasSpot`, `isRegistrationOpen(event, held)` returns `{open}|{open:false,reason}`; no `now` param, no date rule in spec)
- [x] 2.5 form-schema (`parseFormSchema`, `validateAnswers` returns `{data}|{errors}`, `validateSchemaEdit(current, next, answeredFieldIds)` per spec lock: add/relabel ok, no delete or type change of answered fields)
- [x] 2.6 money, clabe, payment (policies + `policyFor`), receipt-file (`validateReceiptFile`)
Strict TDD: each module's test written first and run RED (module not found) before implementation.
Verification: vitest 73/73 (10 files); see report for tsc/lint.
Next: PR3 (not started).

## Batch 3b: PR2 review fixes (same branch)
- token: canonical base64url only (charset + round-trip), signing secret >= 32 chars enforced on sign and verify.
- status/payment/money: invalid priceCents/cents (negative, fractional, NaN) throw.
- form-schema: field ids /^[a-z][a-z0-9_]{0,40}$/, own-property reads, null-prototype answers/errors, plain-decimal numbers, limits (50 fields, label 200, 50 options x 200, text 2000, email 254 checked before regex).

Notes for later PRs (not implemented here):
- PR4 (receipt upload): capacity MUST be re-checked atomically (event row lock) on PENDING_RECEIPT/REJECTED -> PENDING_VALIDATION.
- PR5/PR6 (receipt serving): use Content-Disposition: attachment, X-Content-Type-Options: nosniff and the server-sniffed MIME, never a stored/declared one.
- Any short-code lookup endpoint MUST be rate-limited.
- PR8 (check-in): verify the ticket's eventId matches the door session's event.

## Batch 4: PR3 (branch feat/ticketing-pr3-config-hub) - DONE
- [x] 3.1 `lib/server/guards.ts` (`getOwnedEvent` cached, null for missing AND foreign; `requireEventOwner` redirects anon, notFound for non-owner); `lib/env.ts` (`readTicketingEnv(source)` pure + lazy `getTicketingEnv()`, so pages not sending email boot without the vars)
- [x] 3.2 hub layout `app/dashboard/events/[id]/layout.tsx` + `EventHubTabs` (Boletos y pagos, Formulario)
- [x] 3.3 `parseTicketingConfig` (pure, TDD) + `updateTicketingConfig` action + `TicketingForm`; SPEI fields required only when price > 0 and SPEI enabled
- [x] 3.4 `FormBuilder` + `updateFormSchema` using `validateSchemaEdit` with `collectAnsweredFieldIds(Ticket.answers)`; `generateFieldId`/`moveItem` pure helpers
Strict TDD: ticketing-config, form-builder, env tests written first and run RED (module not found).
Verification: vitest 106/106 (13 files); tsc clean; lint baseline (1 error EventsList, 2 warnings); build OK.
Notes: name/email are fixed fields outside formSchema (validateAnswers handles them). No migration needed. `.env.template` documents the new vars as commented entries.
Next: PR4 (not started).

## Batch 4b: PR3 review fixes (same branch)
- Price capped at 100,000 MXN; CLABE validated whenever non-empty; bank/beneficiary max 100 chars.
- validateSchemaEdit locks every answered id even if `current` does not list it (corrupt stored schema).
- .env.template: NEXT_PUBLIC_APP_URL is now an active placeholder (required by lib/env.ts).

Notes for PR4:
- Registration/receipt flow must handle capacity lowered below already-held tickets: treat as full (never negative remaining).
- displayCapacity is marketing-only; never use it for enforcement.

## Batch 5: PR4 (branch feat/ticketing-pr4-registration) - DONE
- [x] 4.1 resend@6.32.1; EmailSender port, ResendSender, ConsoleSender (non-production fallback only), templates (received, ticket, rejected; HTML-escaped, subject CRLF-stripped); lib/env.ts: signing secret always required, RESEND_API_KEY/EMAIL_FROM/NEXT_PUBLIC_APP_URL required only in production (dev: console sender, localhost:3000)
- [x] 4.2 lib/server/rate-limit.ts (single upsert SQL, fails closed on DB error) + request-keys.ts (getClientIp first XFF hop with IP-shape check; rateLimitKey hashes the value)
- [x] 4.3 registerForEvent: IP 10/10min and event+email 3/10min; tx with SELECT ... FOR UPDATE on Event, re-read event inside lock, duplicate -> re-send link with same generic response, closed/full refused for new emails, FREE -> PAID, paid -> PENDING_RECEIPT; short-code collision retried around the whole tx (P2002); email after commit, best-effort, registrationEmailSentAt / ticketEmailSentAt only on success
- [x] 4.4 getEventBySlug now returns price, displayCapacity, parsed formSchema and `availability` (capacity never returned); public page with RegistrationForm, "Gratis"/price, ShareEventButton; header link and share-QR block removed
Strict TDD: env, templates, registration rules, request-keys, formatEventDate written first and run RED (module/function missing).
Verification: vitest 136/136 (16 files); tsc clean; lint baseline (1 error EventsList, 2 warnings); build OK.
Not verified: rate-limit SQL and the FOR UPDATE transaction were not run against a DB (only DB is the remote one; no local docker).
Notes for PR5: receipt upload MUST lock the same Event row (SELECT ... FOR UPDATE) and re-check capacity (held < capacity) before PENDING_RECEIPT/REJECTED -> PENDING_VALIDATION. Ticket page URL is /ticket/{token}; QR image URL is /api/tickets/{token}/qr.png (emails already link to both).
Next: PR5 (not started).

## Batch 6: PR5 (branch feat/ticketing-pr5-ticket-receipt) - DONE
- [x] 5.1 `/ticket/[token]` page (verify token -> notFound; view by status via pure `ticketViewFor`; explicit select, no Receipt bytes; metadata referrer no-referrer + robots noindex; no nav; SpeiInstructions, ReceiptUpload, TicketCard)
- [x] 5.2 `POST /api/tickets/[token]/receipt`: token, Content-Length required and guarded (5.5 MiB), per-IP (skipped without IP) and per-ticket limits (1h), sniffed MIME via validateReceiptFile, tx with Event FOR UPDATE, `decideReceiptUpload` (status + capacity re-check, lowered capacity = full), Receipt created (history kept, 1:N), conditional updateMany to PENDING_VALIDATION (count != 1 rolls back)
- [x] 5.3 `GET /api/tickets/[token]/qr.png` (PAID/CHECKED_IN only, else 404; QR encodes the signed ticket token string; private no-store, nosniff)
Strict TDD: ticket-view and receipt-upload tests written first, RED (module not found), then GREEN.
Verification: vitest 161/161 (20 files); tsc clean; lint baseline (1 error EventsList, 2 warnings); build OK.
Not verified: routes/transaction not run against a DB.
Notes for PR6: receipt serving route must use Content-Disposition attachment, nosniff, and the stored mimeType (sniffed at upload). Review actions that change status should use conditional updateMany.
Next: PR6 (not started).

Review fixes (PR5): body read is now streamed with a byte cap (missing Content-Length allowed, early 413 when present and too large); per-ticket limit 20/h; cancelled event shows the cancelled view.
Notes for PR6: the purge job must also purge superseded receipts (older Receipt rows of the same ticket); the organizer view must read the latest receipt by uploadedAt.

## Batch 7: PR6 (branch feat/ticketing-pr6-organizer-review) - DONE
- [x] 6.1 Attendees tab (`/dashboard/events/[id]/attendees`): status counts, URL-driven status filter + search (name/email/normalized short code), pagination (25), mobile-friendly list; latest receipt metadata only (never bytes). Pure: `lib/ticketing/attendees.ts`.
- [x] 6.2 `review.actions.ts`: approve/reject via conditional `updateMany` (PENDING_VALIDATION), email only when count===1 via `after()`; reject reason required (max 300); resend by status; cancel conditional on observed status. Every action re-checks ownership via `getOwnedEvent` and ticket.eventId. `sendTicketEmail` extended with kind "rejected" (+reason). Pure: `lib/ticketing/review.ts`. UI: `AttendeesList`, `ReceiptDialog`.
- [x] 6.3 `GET /api/receipts/[receiptId]`: session + owner else 404, 410 if purged; headers from `receiptHeaders` (images inline + nosniff + CSP sandbox, PDF/other attachment, private no-store).
- [x] 6.4 `purgeExpiredReceipts(now)` (bounded batch 500; expired events >30d + superseded), lazy via `after()` on attendees page, optional `GET /api/cron/purge-receipts` (CRON_SECRET Bearer, timingSafeEqual over hashes; 404 unset, 401 mismatch). `.env.template` documents CRON_SECRET.
Strict TDD: attendees, review, receipt-purge, receipt-response, cron-auth tests RED (module not found) then GREEN.
Verification: vitest 199/199 (26 files); tsc clean; lint baseline (1 error EventsList, 2 warnings); build OK.
Not verified: actions, routes, purge queries not run against a DB.
Next: PR7 (not started).

## Batch 8: PR7 (branch feat/ticketing-pr7-door-access) - DONE
- [x] 7.1 `lib/ticketing/door-pin.ts` (generatePin via crypto.randomInt, generateDoorKey 256-bit base64url, hashDoorKey sha256, hashPin/verifyPin scrypt N=16384 random salt + timingSafeEqual, nextLockout/isLocked 5 failures -> 15 min with injected `now`, parseStaffName, sessionMatchesAccess) and `door-view.ts` (whitelist projections: no receipts, amounts, email, SPEI, settings).
- [x] 7.2 Owner page `/dashboard/events/[id]/door` (+ "Puerta" tab): generate/regenerate (upsert, sessionVersion++), revoke; link and PIN shown once with copy buttons; only hashes stored; every action re-checks `getOwnedEvent`.
- [x] 7.3 Public `/door/[key]` + `PinForm` + `unlockDoor`/`logoutDoor` actions: per-IP (20/10min, skipped without IP) and per-access (40/10min) rate limits, DB lockout via atomic increment, cookie `door_session` httpOnly/sameSite=strict/secure in prod, path `/door/<key>`, 12h. `lib/server/door-session.ts`: `findActiveDoorAccess`, `getDoorSession(key)` -> {access, event (staff-safe), staffName}; verifies signature, exp, accessId and sessionVersion/revokedAt against DB. Landing shows "Acceso concedido, <name>" + event info + Salir. noindex, no-referrer.
Migration `20261008210000_door_access`: `migrate dev` hung non-interactively; fallback `migrate diff` (additive: CREATE TABLE DoorAccess + 2 unique indexes + FK cascade), applied with `db:deploy`. A hung prisma/schema-engine process held the advisory lock and had to be killed first.
Strict TDD: door-pin and door-view tests RED (module not found), then GREEN; sessionMatchesAccess RED (2 failed) then GREEN.
Verification: vitest 223/223 (28 files); tsc clean; lint baseline (1 error EventsList, 2 warnings); build OK; migrate status up to date.
Not verified: actions/pages not run against the DB or in a browser.
Notes for PR8: use getDoorSession(key) in every door action; verify ticket.eventId === session.access.eventId; use toDoorTicketView; ticket check-in must be conditional updateMany.
Next: PR8 (not started).
