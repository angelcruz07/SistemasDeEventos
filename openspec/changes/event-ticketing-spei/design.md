# Design: Event Ticketing with SPEI Validation and Door Check-in

## Technical Approach

Keep the existing Next 16 App Router conventions: feature folders, co-located `_actions` returning `{ success, data | error }`, hand-rolled validation, Spanish UI copy. Add one rule: **domain logic lives in pure modules under `lib/ticketing/`** with no Prisma, Next, or env access. Callers inject everything, so these modules are unit-tested with Vitest. Side effects stay in `lib/server/` (guards, rate limiting, door session, purge) and `lib/email/` (adapter). Route handlers cover three cases: binary I/O (receipt upload and view, QR PNG, PDF, CSV), bodies over the 1MB server-action limit, and image URLs embedded in emails.

Settled inputs: `explore.md` decisions, plus two organizer resolutions. A REJECTED ticket holds no capacity spot. Receipt bytes are purged 30 days after the event and the metadata is kept.

```
Browser ──> app/** page / _actions / api route
               │  (auth: requireEventOwner | door session | ticket token)
               ▼
          lib/server/*  ── prisma (app/lib/prisma.ts) ──> PostgreSQL
               │
               ▼
          lib/ticketing/* (pure: token, status, capacity, form-schema, ...)
               │
          lib/email/sendEmail ──> Resend (console sender in dev)
```

## Architecture Decisions

| # | Decision | Alternatives rejected | Rationale |
|---|----------|----------------------|-----------|
| 1 | Pure domain modules in `lib/ticketing/`, I/O in `lib/server/` | Logic inline in actions (current style) | Only testable seam without DB fixtures; TDD is mandated |
| 2 | **One ticket token** (HMAC-SHA256, purpose `ticket`) for `/ticket/[token]`, the QR payload, the receipt upload, the QR PNG and the PDF. The page renders by status. | Separate receipt token stored in DB | Fewer routes and less state. A QR made from an unpaid ticket's URL is harmless because check-in needs `PAID`. No revocation is needed because ticket status gates every action. |
| 3 | Token = `base64url(ticketId) + "." + base64url(HMAC(secret, "ticket:v1:" + ticketId))`, verified with `timingSafeEqual` | JWT lib; random token column | No dependency, deterministic and re-derivable for resend; `v1` allows rotation |
| 4 | Receipts stored as `bytea` in Postgres, served only to the owner | Cloudinary private/authenticated assets | Cloudinary route returns public URLs; low volume; one backup surface; purge is a single UPDATE |
| 5 | Capacity enforced inside an interactive transaction with `SELECT ... FOR UPDATE` on the Event row | Optimistic count-then-insert; DB counter column | Count and transition are atomic, and there is no counter drift on reject or cancel |
| 6 | Single-use check-in via `updateMany({ where: { id, eventId, status: PAID } })`. If count is 0, re-read the ticket and report its state. | Transaction + read | One statement; race-free across phones |
| 7 | Rate limiting in a DB fixed-window table (`RateLimitBucket`, single upsert SQL) | In-memory Map; Redis/Upstash | Works across instances/restarts with zero new infra; volume is tiny. In-memory is wrong when there are several instances. |
| 8 | Door access = random link key (sha256 stored) + 6-digit PIN (scrypt) → signed `door_session` cookie (HMAC, purpose `door`, carries `sessionVersion` + staff name, 12h) | Staff user accounts; PIN-only URL | No accounts (settled). Two factors. Bumping `sessionVersion` revokes every phone at once. |
| 9 | Payment behind a small port (`PaymentMethodPolicy`): SPEI (manual), CASH (door), FREE. No gateway is built. | Hard-coded `if` branches | Mercado Pago can be added later as a new policy without touching the status machine |
| 10 | Email behind `EmailSender`. `ResendSender` is used when `RESEND_API_KEY` is set, otherwise `ConsoleSender`. Templates are plain HTML string functions. | react-email; SMTP/nodemailer | Fewest dependencies. Email failure never blocks a registration (`*EmailSentAt` + resend button). |
| 11 | QR in email = `<img src="{APP_URL}/api/tickets/{token}/qr.png">` | data: URI (Gmail strips); inline CID attachment | Reliable across clients; reuses `qrcode` dep (`toBuffer`) |
| 12 | Event management hub `app/dashboard/events/[id]/` with tabs (ticketing, form, attendees, door, design); the create/edit modal stays basic | Grow `EventForm.tsx` (already ~500 lines) | Keeps PRs small and pages owner-guarded once in a layout |
| 13 | Door URL `/door/[key]` (not `/door/[eventId]` as sketched in the proposal) | eventId in the path | No event-id enumeration; a single indexed lookup |
| 14 | `/ticket/[token]` stays a plain route (no route group). The root `app/layout.tsx` has no nav, so a group adds nothing. | `(public)` group | Simpler. The nav leak is only in `app/event/[slug]/page.tsx` (header link), which is removed. |
| 15 | Ticket design stored as `ticketDesign Json` (template + hex colors + Cloudinary URLs), validated by a pure function | Separate table | One-to-one with Event; validated shape |

## Data Model (Prisma diff)

```prisma
enum TicketStatus { PENDING_RECEIPT PENDING_VALIDATION PAID CHECKED_IN REJECTED CANCELLED }
enum PaymentMethod { SPEI CASH FREE }

model Event {   // + fields; slice 2 drops imageUrl
  priceCents       Int      @default(0)
  currency         String   @default("MXN")
  allowSpei        Boolean  @default(true)
  allowCash        Boolean  @default(false)
  speiClabe        String?
  speiBank         String?
  speiBeneficiary  String?
  capacity         Int?               // internal, never public
  displayCapacity  Int?               // marketing number, optional
  registrationOpen Boolean  @default(true)
  formSchema       Json     @default("{\"version\":1,\"fields\":[]}")
  ticketDesign     Json?              // slice 2
  tickets    Ticket[]
  images     EventImage[]             // slice 2
  doorAccess DoorAccess?              // slice 2
  // removed: attendances, confirmations
}

model Ticket {
  id              String        @id @default(uuid())
  eventId         String
  code            String        @unique          // Crockford, 6 chars, shown "7K3-Q9M"
  name            String
  email           String?                         // lowercased; null only for door walk-ins
  answers         Json          @default("{}")    // { [fieldId]: { label, value } }
  status          TicketStatus
  paymentMethod   PaymentMethod
  amountCents     Int
  currency        String        @default("MXN")
  rejectionReason String?
  reviewedAt      DateTime?
  checkedInAt     DateTime?
  checkedInBy     String?                         // staff name or "Organizador"
  registrationEmailSentAt DateTime?
  ticketEmailSentAt       DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  event    Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  receipts Receipt[]
  @@unique([eventId, email])                      // NULLs distinct in PG
  @@index([eventId, status])
}

model Receipt {               // 1:N keeps rejected-upload history
  id String @id @default(uuid())
  ticketId String
  bytes Bytes?                // null after purge (Uint8Array in Prisma 7)
  mimeType String
  sizeBytes Int
  sha256 String
  uploadedAt DateTime @default(now())
  purgedAt DateTime?
  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  @@index([ticketId, uploadedAt])
}

model RateLimitBucket { key String @id  windowStart DateTime  count Int }

// slice 2
model DoorAccess {
  id String @id @default(uuid())
  eventId String @unique
  keyHash String @unique      // sha256(link key)
  pinHash String              // scrypt$N$salt$hash
  sessionVersion Int @default(1)
  failedAttempts Int @default(0)
  lockedUntil DateTime?
  revokedAt DateTime?
  createdAt DateTime @default(now())
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
}
model EventImage {
  id String @id @default(uuid())
  eventId String
  url String
  position Int
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  @@index([eventId, position])
}
// DROP: Attendance, Confirmation (slice 1); Event.imageUrl (slice 2)
```

### Migrations (Prisma 7 + `prisma.config.ts`)

- Scripts: `"db:migrate": "prisma migrate dev && prisma generate"` (Prisma 7 `migrate dev` no longer auto-generates), `"db:deploy": "prisma migrate deploy"`, `"db:generate": "prisma generate"`, `"test": "vitest run"`.
- Migration `ticketing` (Slice 1): enums, Event columns, Ticket, Receipt, RateLimitBucket, drop Attendance and Confirmation (legacy data discarded, settled).
- Migration `door_and_images` (Slice 2): generated with `--create-only`, then the SQL is hand-edited to backfill before the drop:
  `INSERT INTO "EventImage"(id,"eventId",url,position) SELECT gen_random_uuid(), id, "imageUrl", 0 FROM "Event" WHERE "imageUrl" <> '';` then `ALTER TABLE "Event" DROP COLUMN "imageUrl";`

## Domain Modules (`lib/ticketing/`, all pure and tested)

| Module | Contract |
|--------|----------|
| `token.ts` | `signTicketToken(id, secret)`, `verifyTicketToken(token, secret): string \| null`; `signDoorSession(payload, secret)`, `verifyDoorSession(...)` (purpose-separated HMAC) |
| `short-code.ts` | `generateShortCode(rand)` (Crockford alphabet `0-9A-Z` minus `I L O U`), `normalizeShortCode(input)` (maps O→0, I/L→1, strips `-`). Caller retries up to 5 times on a unique violation. |
| `status.ts` | `canTransition(from, to)`, `initialStatus({ method, priceCents, channel })`; table below |
| `capacity.ts` | `HOLDING = [PENDING_VALIDATION, PAID, CHECKED_IN]`, `hasSpot(held, capacity)`, `isRegistrationOpen(event, held, now)` |
| `form-schema.ts` | `parseFormSchema(json)`, `validateSchemaEdit(old, next, hasTickets)` (no delete or type change when tickets exist), `validateAnswers(schema, input)` → `{ answers } \| { errors }` |
| `money.ts` / `clabe.ts` | `parsePesosToCents("350.50")`, `formatMxn`; `isValidClabe` (18 digits + check digit) |
| `payment.ts` | `PaymentMethodPolicy` port + `SPEI`, `CASH`, `FREE` policies |
| `receipt-file.ts` | `sniffReceiptMime(bytes)`: JPEG `FFD8FF`, PNG `89504E47…`, WebP `RIFF????WEBP`, PDF `%PDF-`, else null; `MAX_RECEIPT_BYTES = 5 MiB` |
| `door-pin.ts` | `hashPin`, `verifyPin` (scrypt + timingSafeEqual), `nextLockout(failedAttempts)` |
| `door-view.ts` | `toDoorTicketView(ticket)`: projection that has no receipts and no money totals |
| `csv.ts` / `cash-up.ts` | RFC4180 escaping + formula-injection guard (`= + - @` get a `'` prefix); totals grouped by method |
| `ticket-design.ts` | `parseTicketDesign` (template enum, `#rrggbb`, https URLs) with defaults |
| `lib/datetime.ts` | `formatMx(date)` with `timeZone: "America/Mexico_City"` |

Status transitions:

| From | To | Trigger |
|------|----|---------|
| (new) | PENDING_RECEIPT | public SPEI, price > 0 |
| (new) | PAID | public, price = 0 (FREE) |
| (new) | CHECKED_IN | door walk-in CASH (ignores cap) |
| PENDING_RECEIPT, REJECTED | PENDING_VALIDATION | receipt upload (capacity check) |
| PENDING_VALIDATION | PENDING_VALIDATION | re-upload replaces pending receipt |
| PENDING_VALIDATION | PAID / REJECTED(reason) | organizer review (conditional `updateMany`, idempotent) |
| PAID | CHECKED_IN | door |
| any non-terminal | CANCELLED | organizer |

```ts
// lib/ticketing/payment.ts
export interface PaymentMethodPolicy {
  method: "SPEI" | "CASH" | "FREE";
  channel: "public" | "door";
  initialStatus(priceCents: number): TicketStatus;
}
// lib/email/email-sender.ts
export interface EmailMessage { to: string; subject: string; html: string; text: string }
export type SendResult = { ok: true; id: string } | { ok: false; error: string };
export async function sendEmail(msg: EmailMessage): Promise<SendResult>; // never throws
```

## Routes and Pages

| Path | Kind | Guard |
|------|------|-------|
| `app/event/[slug]/page.tsx` | public page: carousel (s2), price, `displayCapacity`, `RegistrationForm` rendered from `formSchema`, `ShareEventButton`; "Volver a eventos" removed | none + rate limit on action |
| `app/event/[slug]/_actions/registration.actions.ts` | `registerForEvent` (dedupe by email: resend the link, same generic response) | rate limit ip + email |
| `app/ticket/[token]/page.tsx` | status view: SPEI instructions + upload (PENDING_RECEIPT/REJECTED with reason), "en revisión", or ticket + QR + share + PDF | token |
| `app/api/tickets/[token]/receipt/route.ts` | POST multipart: rejects if Content-Length > 5.5MB, size ≤ 5MiB, sniffed mime, tx(lock event, transition, capacity, insert Receipt) | token + rate limit |
| `app/api/tickets/[token]/qr.png/route.ts` | PNG only if PAID or CHECKED_IN | token |
| `app/api/tickets/[token]/pdf/route.ts` (s2) | `@react-pdf/renderer` `renderToBuffer`, `runtime = "nodejs"` | token, PAID or CHECKED_IN |
| `app/dashboard/events/[id]/layout.tsx` | tabs; `requireEventOwner` | owner |
| `…/[id]/ticketing/page.tsx` | price, methods, SPEI, capacity, display number, `registrationOpen` | owner |
| `…/[id]/form/page.tsx` | form builder (edit locks) | owner |
| `…/[id]/attendees/page.tsx` | filters (status, q), receipt dialog, approve/reject/resend/cancel, cash-up (s2); triggers lazy purge | owner |
| `app/api/receipts/[receiptId]/route.ts` | serves bytes: `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`; 410 if purged | owner only |
| `…/[id]/attendees/export/route.ts` (s2) | CSV (UTF-8 BOM for Excel) | owner |
| `…/[id]/door/page.tsx` (s2) | generate or regenerate the link + PIN (shown once), revoke | owner |
| `…/[id]/design/page.tsx` (s2) | ticket design editor with live preview | owner |
| `app/door/[key]/page.tsx` + `_actions/door.actions.ts` (s2) | name + PIN unlock → console: scanner, search by name or code, check-in, walk-in cash | door session |
| `app/api/cron/purge-receipts/route.ts` | optional external trigger, `Authorization: Bearer CRON_SECRET` | secret |

`proxy.ts` is unchanged. Its matcher covers only `/dashboard`, `/login` and `/register`, so the public, ticket, door and api routes bypass it, and so does its body-size clone limit.

## Sequences

**SPEI registration → approval**
```
Attendee  EventPage  registerForEvent  DB           EmailSender   Organizer
  |--submit-->|--------->| rateLimit(ip,email)       |              |
  |           |          | validateAnswers, isOpen   |              |
  |           |          |--insert PENDING_RECEIPT-->| (dup email: load existing)
  |           |          |--sendEmail(received, /ticket/{t})------->| set registrationEmailSentAt
  |<-- "Revisa tu correo" (same message on dup) ------|              |
  |--open /ticket/{t}: SPEI data, concept=code; upload ---> POST receipt
  |                       tx: FOR UPDATE event; held<cap?; insert Receipt; -> PENDING_VALIDATION
  |                                                                  |--open attendees
  |                                                                  |--view /api/receipts/{id}
  |                       approve: updateMany(status=PENDING_VALIDATION -> PAID) count==1?
  |                         yes -> sendEmail(ticket: link + qr.png [+ PDF s2]); set ticketEmailSentAt
  |                         no  -> "ya revisado" (no double email)
  |                       reject(reason): -> REJECTED, email with re-upload link (frees the spot)
```

**Door check-in**
```
Staff     /door/{key}      door.actions         DB
  |--name+PIN-->| rateLimit(ip); DoorAccess by sha256(key); not revoked/locked
  |             | verifyPin fail -> failedAttempts++ (5 -> lockedUntil +15m)
  |<-- Set-Cookie door_session{aid,v,name,exp} (httpOnly, Secure, SameSite=Lax, path=/door)
  |--scan QR--> lookupByToken: verifyTicketToken -> ticket (same eventId) -> toDoorTicketView
  |--"Registrar entrada"--> updateMany({id,eventId,status:PAID}, CHECKED_IN, now, name)
  |             count 1 -> OK | count 0 -> reread -> "Ya registrado a las HH:MM por X" / "Pago no validado"
  (search: normalizeShortCode or name ILIKE, PAID/CHECKED_IN first; same check-in action)
```

**Walk-in cash**
```
Staff --name[,email]--> registerWalkIn: session valid; event.allowCash
   insert Ticket{CASH, amountCents=priceCents, CHECKED_IN, checkedInAt=now, checkedInBy=name}
   (no capacity check; email optional, if present send ticket email best-effort)
```

## Security

- Every server action and route re-validates on the server. The `door_session` cookie is checked against `DoorAccess.sessionVersion` and `revokedAt` on every call.
- Receipts are reachable only via `/api/receipts/[id]` with `requireEventOwner`. Door views never select `Receipt` or amounts beyond the walk-in price. No public URL exists for them.
- PIN: 6 digits from `crypto.randomInt`. Lockout is per DoorAccess (5 failures → 15 min) plus a per-IP rate limit, and the link key is a 32-byte random value as the first factor.
- Rate limits (`lib/server/rate-limit.ts`; the IP comes from the first hop of `x-forwarded-for`, which requires a trusted proxy): registration 10/10min/IP and 3/10min/email; upload 5/h/ticket and 20/h/IP; PIN 10/15min/IP.
- Env (`lib/env.ts` fails fast on missing values): `TICKET_SIGNING_SECRET` (≥32 bytes), `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` (now required), and an optional `CRON_SECRET`. All are added to `.env.template`.
- Purge: `purgeExpiredReceipts()` runs `UPDATE Receipt SET bytes=NULL, purgedAt=now()` where the event date is more than 30 days in the past. It runs lazily on attendees and dashboard loads, plus the optional cron route.

## Existing Bug Fixes (Slice 0)

- `updateEvent`: drop the `generateSlug` call and the `slug` from update data. Slugs are immutable after creation.
- `updateEvent`: remove the `isEventDateTimeInPast` block. Keep it in `createEvent` only. This also avoids the server-local vs UTC-midnight comparison bug.
- `deleteEvent`: remove the manual `confirmation` and `attendance` deletes (cascade covers them; the models go away in Slice 1).

## Libraries

| Package | Version | Compatibility note |
|---------|---------|--------------------|
| `vitest`, `vite-tsconfig-paths` (dev) | `^3.2` / `^5` | node env; `vitest.config.mts` |
| `resend` | latest `^6` | server-only |
| `@react-pdf/renderer` | `^4.3` | React 19 supported since 4.1. If Turbopack bundling fails, add `serverExternalPackages: ["@react-pdf/renderer"]`. |
| `@yudiel/react-qr-scanner` | `^2` | Not in `node_modules`, so the peer range could not be verified. Run `bun info @yudiel/react-qr-scanner peerDependencies` before install. Fallback is `qr-scanner` (nimiq, framework-agnostic). Load via `next/dynamic` with `ssr:false`. Manual search always exists. |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | all `lib/ticketing/*` modules + `lib/datetime.ts` | Vitest, `environment: "node"`, `include: ["lib/**/*.test.ts"]`, strict TDD, `bunx vitest run` |
| Integration | transactions, rate-limit SQL, guards | manual against docker Postgres (no DB test harness in scope) |
| E2E | full SPEI flow, two-phone door rehearsal | manual checklist; rehearsal ~2026-10-26 |

## File Changes and PR Boundaries

**Slice 0, PR0 (~200 lines)**: modify `event.actions.ts` (bug fixes) and `package.json` (scripts, vitest); create `vitest.config.mts` and `lib/datetime.ts` + test; delete the empty `update-event.action.ts`, `delete-event.action.ts` and `get-event.action.ts`.

**Slice 1**
| PR | Files | Est. |
|----|-------|------|
| PR1 schema | `prisma/schema.prisma`, `prisma/migrations/*_ticketing/`; remove RSVP: `ConfirmAttendanceForm.tsx` (delete), `EventAttendeesModal.tsx` (delete), `confirmAttendance`/`getAttendancesForEvent` (remove), `dashboard.actions.ts` + `app/dashboard/page.tsx` (ticket counts), `EventCard.tsx` (link to hub) | ~350 |
| PR2 domain | `lib/ticketing/{token,short-code,status,capacity,form-schema,money,clabe,payment,receipt-file}.ts` + tests | ~400 |
| PR3 config | `lib/server/guards.ts`, `lib/env.ts`, `app/dashboard/events/[id]/{layout,ticketing/page,form/page}.tsx`, `[id]/_actions/ticketing.actions.ts`, `[id]/_components/{TicketingForm,FormBuilder}.tsx`, `.env.template` | ~400 |
| PR4 registration | `lib/email/{email-sender,resend-sender,console-sender,templates}.ts`, `lib/server/rate-limit.ts`, `app/event/[slug]/page.tsx` (modify), `_components/{RegistrationForm,ShareEventButton}.tsx`, `_actions/registration.actions.ts` | ~400 |
| PR5 ticket page | `app/ticket/[token]/page.tsx`, `_components/{ReceiptUpload,SpeiInstructions,TicketCard}.tsx`, `app/api/tickets/[token]/{receipt,qr.png}/route.ts` | ~380 |
| PR6 review | `[id]/attendees/page.tsx`, `_components/{AttendeesTable,ReceiptDialog}.tsx`, `_actions/review.actions.ts`, `app/api/receipts/[receiptId]/route.ts`, `lib/server/receipts-purge.ts`, optional cron route | ~400 |

**Slice 2** (critical first; PR10 and PR11 can be dropped)
| PR | Files | Est. |
|----|-------|------|
| PR7 door access | migration `door_and_images` (DoorAccess only, or split), `lib/ticketing/{door-pin,door-view}.ts` + tests, `lib/server/door-session.ts`, `[id]/door/page.tsx`, `app/door/[key]/page.tsx` + `PinForm` | ~380 |
| PR8 check-in | `app/door/[key]/_actions/door.actions.ts`, `_components/{Scanner,TicketSearch,CheckInCard,WalkInForm}.tsx` | ~400 |
| PR9 reporting | `lib/ticketing/{csv,cash-up}.ts` + tests, `[id]/attendees/export/route.ts`, `CashUpSummary.tsx` | ~250 |
| PR10 design + PDF | `lib/ticketing/ticket-design.ts` + test, `lib/pdf/TicketDocument.tsx`, `[id]/design/page.tsx`, `app/api/tickets/[token]/pdf/route.ts`, `next.config.ts` (if needed) | ~400 |
| PR11 images | EventImage backfill migration, `EventForm.tsx`, `EventCard.tsx`, `interfaces/event.interface.ts`, `createEvent`/`updateEvent`, `app/event/[slug]/_components/ImageCarousel.tsx` | ~350 |

## Migration / Rollout

Before launch: migrations can be reset. After launch: only additive migrations, and code is reverted per PR. Run `db:deploy` in the deploy step before `next start`. Resend domain DNS must show Verified before PR4 ships to production. The door fallback is the printed CSV (PR9).

## Open Questions

- [ ] Walk-in email optional (design assumes yes; `email` nullable). Spec should confirm.
- [ ] Scanner peer-dependency range for React 19 must be checked at install time.
- [ ] Deploy target (single node vs serverless) affects only the trust in the IP header; the DB rate limit works either way.
