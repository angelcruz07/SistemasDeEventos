# Tasks: Event Ticketing with SPEI Validation and Door Check-in

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,300 total: S0 ~200, S1 ~2,330, S2 ~1,780 |
| 400-line budget risk | High (every PR sits at 350-400; any overrun breaks the budget) |
| Chained PRs recommended | Yes |
| Suggested split | PR0 -> PR1..PR6 (S1) -> PR7..PR11 (S2) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Rules for every PR: Strict TDD (RED test, GREEN, REFACTOR) for `lib/ticketing/*`; work-unit commits (conventional, no AI attribution); verify with `bunx tsc --noEmit`, `bun run lint`, `bunx vitest run` (after PR0). If a PR trends over 400 lines, split by the file groups listed, never by dropping tests. For feature-branch-chain: PR0 base = tracker branch, each later PR base = previous PR branch.

### Suggested Work Units

| Unit | Goal | PR | Notes |
|------|------|----|-------|
| S0 | Bug fixes + Vitest + scripts | PR0 | independent, merges first |
| S1 | Schema, domain, config, registration, ticket page, review | PR1-PR6 | sequential (PR1 -> PR6) |
| S2 critical | Door access, check-in, reporting | PR7-PR9 | PR7 -> PR8 -> PR9 |
| S2 droppable | Design editor + PDF; image carousel | PR10, PR11 | DROPPABLE under deadline; PR10 and PR11 independent of each other |

## Manual setup (organizer, not code)

- [ ] M.1 Verify the sending domain in Resend (DNS shows Verified) BEFORE PR4 ships to production.
- [ ] M.2 Set env vars in deploy and local `.env`: `RESEND_API_KEY`, `EMAIL_FROM`, `TICKET_SIGNING_SECRET` (>=32 random bytes), `NEXT_PUBLIC_APP_URL` (https), optional `CRON_SECRET`.
- [ ] M.3 Deploy over HTTPS (camera scanning requires a secure context); run `bun run db:deploy` before `next start`.
- [ ] M.4 Rehearsal ~2026-10-26: SPEI flow end to end (register, upload, approve, email QR), two phones scanning the same ticket, wrong PIN lockout, walk-in cash, printed CSV fallback.

## S0

### PR0: Fixes, Vitest, scripts (~200 lines, base: main/tracker)
Files: `app/dashboard/_actions/event.actions.ts` (path per repo), `package.json`, `vitest.config.mts`, `lib/datetime.ts` + `lib/datetime.test.ts`; delete `update-event.action.ts`, `delete-event.action.ts`, `get-event.action.ts`.
- [x] 0.1 STOP-AND-REPORT: working tree has uncommitted `.env.template`, `bun.lock`, `docker-compose.yml`. Do NOT commit, stash, or discard them; report to the orchestrator and wait. Keep PR0 commits limited to the files above.
- [x] 0.2 `bun add -d vitest@^3.2 vite-tsconfig-paths@^5`; create `vitest.config.mts` (node env, `include: ["lib/**/*.test.ts"]`, tsconfigPaths).
- [x] 0.3 Add scripts: `test`, `db:migrate` (`prisma migrate dev && prisma generate`), `db:deploy`, `db:generate`.
- [x] 0.4 RED: `lib/datetime.test.ts` for `formatMx` (America/Mexico_City, UTC boundary cases). GREEN: `lib/datetime.ts`.
- [x] 0.5 `updateEvent`: remove `generateSlug` and `slug` from update data (spec: Slug stability).
- [x] 0.6 `updateEvent`: remove `isEventDateTimeInPast` block; keep in `createEvent` (spec: Editing past events).
- [x] 0.7 `deleteEvent`: remove manual `confirmation`/`attendance` deletes (cascade).
- [x] 0.8 Delete the three empty action files; fix imports if any.
- Verify: tsc, lint, `bunx vitest run`; manual: edit title keeps slug; edit event started 1h ago saves.
- Rollback: revert PR (no schema change).

## S1

### PR1: Schema + RSVP removal (~350, base PR0)
Files: `prisma/schema.prisma`, `prisma/migrations/*_ticketing/`, delete `ConfirmAttendanceForm.tsx`, `EventAttendeesModal.tsx`; remove `confirmAttendance`/`getAttendancesForEvent`; edit `dashboard.actions.ts`, `app/dashboard/page.tsx`, `EventCard.tsx` (link to hub).
- [x] 1.1 Add enums, Event columns, Ticket (`email` nullable, `@@unique([eventId,email])`), Receipt, RateLimitBucket; drop Attendance/Confirmation.
- [x] 1.2 `bun run db:migrate` (name `ticketing`); review SQL.
- [x] 1.3 Delete RSVP components/actions; replace dashboard stats with ticket counts by status.
- [x] 1.4 Point `EventCard` at `/dashboard/events/[id]/ticketing`.
- Verify: tsc, lint, app boots, dashboard loads. Rollback: revert PR + `prisma migrate reset` (pre-launch only).

### PR2: Domain modules, test-first (~400, base PR1)
Files: `lib/ticketing/{token,short-code,status,capacity,form-schema,money,clabe,payment,receipt-file}.ts` + `.test.ts` each.
- [x] 2.1 RED/GREEN `token` (sign/verify, tamper, wrong secret, purpose separation, door session).
- [x] 2.2 `short-code` (alphabet excludes I L O U, normalize O->0, I/L->1, strips `-`, collision retry helper).
- [x] 2.3 `status` (every transition in table, invalid refused, `initialStatus`).
- [x] 2.4 `capacity` (HOLDING set, `hasSpot`, `isRegistrationOpen`, rejected frees spot).
- [x] 2.5 `form-schema` (parse, `validateAnswers`, `validateSchemaEdit` lock, invalid email).
- [x] 2.6 `money`, `clabe` (check digit), `payment` policies, `receipt-file` (magic bytes, spoofed .exe, 5 MiB).
- Verify: `bunx vitest run` green, tsc, lint. Rollback: revert (pure code).

### PR3: Organizer config hub (~400, base PR2)
Files: `lib/server/guards.ts`, `lib/env.ts`, `app/dashboard/events/[id]/{layout,ticketing/page,form/page}.tsx`, `_actions/ticketing.actions.ts`, `_components/{TicketingForm,FormBuilder}.tsx`, `.env.template` (coordinate with 0.1 note).
- [x] 3.1 `requireEventOwner` guard; `lib/env.ts` fail-fast.
- [x] 3.2 Hub layout with tabs, owner-guarded once.
- [x] 3.3 Ticketing action + page: price (pesos->cents), methods, SPEI fields required when enabled, capacity, displayCapacity, `registrationOpen`; block price>0 with no method.
- [x] 3.4 Form builder page + action using `validateSchemaEdit`.
- Verify: tsc, lint, vitest; manual: invalid CLABE rejected, non-owner gets denied. Rollback: revert.

### PR4: Public registration + email (~400, base PR3)
Files: `lib/email/{email-sender,resend-sender,console-sender,templates}.ts`, `lib/server/rate-limit.ts`, `app/event/[slug]/page.tsx`, `_components/{RegistrationForm,ShareEventButton}.tsx`, `_actions/registration.actions.ts`.
- [x] 4.1 `npm i resend`; EmailSender port, Resend/Console senders, templates (received, rejected, ticket).
- [x] 4.2 DB fixed-window `rate-limit.ts` (single upsert SQL).
- [x] 4.3 `registerForEvent`: validate, capacity/open, dedupe by email (resend link, generic response), FREE -> PAID + ticket email, set `registrationEmailSentAt`.
- [x] 4.4 Dynamic form render, price, display number, share button; remove "Volver a eventos" link.
- Verify: tsc, lint, vitest; manual: duplicate email, provider down (ticket still created), closed/full refused. Rollback: revert; no data migration.

### PR5: Ticket page + receipt upload (~380, base PR4)
Files: `app/ticket/[token]/page.tsx`, `_components/{ReceiptUpload,SpeiInstructions,TicketCard}.tsx`, `app/api/tickets/[token]/{receipt,qr.png}/route.ts`.
- [x] 5.1 Token-gated page by status; fixed default design; no nav; unknown token -> `notFound()`.
- [x] 5.2 Receipt route: Content-Length guard, size, sniffed mime, rate limit, tx with `FOR UPDATE` + capacity, insert Receipt, status transition.
- [x] 5.3 `qr.png` route (PAID/CHECKED_IN only).
- Verify: tsc, lint; manual: spoofed png, 6MB, bad token, re-upload after reject. Rollback: revert.

### PR6: Organizer review (~400, base PR5)
Files: `[id]/attendees/page.tsx`, `_components/{AttendeesTable,ReceiptDialog}.tsx`, `_actions/review.actions.ts`, `app/api/receipts/[receiptId]/route.ts`, `lib/server/receipts-purge.ts`, optional `app/api/cron/purge-receipts/route.ts`.
- [x] 6.1 Attendees list: status filter, search name/email/code.
- [x] 6.2 Approve/reject via conditional `updateMany`; reason required; email once; resend/cancel.
- [x] 6.3 Receipt route (owner only, no-store, nosniff, 410 if purged).
- [x] 6.4 `purgeExpiredReceipts()` (lazy + optional cron with `CRON_SECRET`).
- Verify: tsc, lint, vitest; manual: double approve sends one email, staff/anon denied. Rollback: revert.

## S2

### PR7: Door access (~380, base PR6)
Files: migration `door_access` (DoorAccess only), `lib/ticketing/{door-pin,door-view}.ts` + tests, `lib/server/door-session.ts`, `[id]/door/page.tsx`, `app/door/[key]/page.tsx` + `PinForm`.
- [x] 7.1 RED/GREEN `door-pin` (scrypt, lockout), `door-view` (no receipts/amounts).
- [x] 7.2 Owner page: generate/regenerate/revoke, PIN shown once. [x] 7.3 Unlock page + signed cookie, `sessionVersion` check.
- Verify: tsc, lint, vitest; manual: wrong PIN x5 locks, regenerated link denied. Rollback: revert + drop table.

### PR8: Check-in console (~400, base PR7)
Files: `app/door/[key]/_actions/door.actions.ts`, `_components/{Scanner,TicketSearch,CheckInCard,WalkInForm}.tsx`.
- [ ] 8.1 Run `bun info @yudiel/react-qr-scanner peerDependencies`; fallback `qr-scanner`; `next/dynamic` ssr:false.
- [ ] 8.2 Lookup (forged/other-event rejected), atomic `updateMany` check-in, "Ya registrado a las HH:MM por X".
- [ ] 8.3 Walk-in cash (email optional, ignores cap, requires `allowCash`).
- Verify: manual on two phones. Rollback: revert.

### PR9: Reporting (~250, base PR8)
Files: `lib/ticketing/{csv,cash-up}.ts` + tests, `[id]/attendees/export/route.ts`, `CashUpSummary.tsx`.
- [ ] 9.1 RED/GREEN csv (formula guard, BOM), cash-up (2 SPEI + 1 cash at 10000 = 200.00/100.00). 9.2 Owner-only route and summary.
- Rollback: revert.

### PR10: Design editor + PDF (~400, base PR9) DROPPABLE
Files: `lib/ticketing/ticket-design.ts` + test, `lib/pdf/TicketDocument.tsx`, `[id]/design/page.tsx`, `app/api/tickets/[token]/pdf/route.ts`, `next.config.ts` if needed.
- [ ] 10.1 RED/GREEN `parseTicketDesign` (hex, https, defaults). 10.2 Editor with live preview. 10.3 PDF route (nodejs runtime; `serverExternalPackages` if Turbopack fails); apply design to TicketCard.
- Rollback: revert; default design remains.

### PR11: Image carousel (~350, base PR9 or PR10) DROPPABLE
Files: migration `event_images` (hand-edited backfill before dropping `imageUrl`), `EventForm.tsx`, `EventCard.tsx`, `interfaces/event.interface.ts`, event actions, `ImageCarousel.tsx`.
- [ ] 11.1 Generate `--create-only`, add INSERT backfill then DROP COLUMN. 11.2 Multi-upload form, carousel, placeholder, single image without controls.
- Rollback: additive-safe only before drop; after launch, revert code and keep column nullable.

## Risks and spec/design conflicts (not silently resolved)

See the result report; items: short-code format, "publish" concept, capacity checked at upload, shared migration name, spec says "receipt token".
