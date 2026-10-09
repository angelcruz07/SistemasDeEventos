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
