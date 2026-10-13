"use server";

import { randomInt, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/app/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { getTicketingEnv } from "@/lib/env";
import {
  DOOR_COOKIE,
  DOOR_SESSION_MS,
  doorCookiePath,
  findActiveDoorAccess,
  getDoorSession,
  type DoorSession,
} from "@/lib/server/door-session";
import { lockEvent } from "@/lib/server/orders";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
import { checkInDecision, escapeLike, parseScanInput, parseSearchQuery, parseWalkIn, type CheckInDecision, type DoorErrorCode } from "@/lib/ticketing/checkin";
import { toDoorTicketView, type DoorTicketView } from "@/lib/ticketing/door-view";
import { ORDER_STATUSES, blocksWalkIn } from "@/lib/ticketing/order";
import { isUniqueViolation } from "@/lib/ticketing/registration";
import { createWithUniqueCode, generateShortCode } from "@/lib/ticketing/short-code";
import { initialStatus } from "@/lib/ticketing/status";
import { MAX_FAILED_ATTEMPTS, nextLockout, parseStaffName, verifyPin } from "@/lib/ticketing/door-pin";
import { signDoorSession } from "@/lib/ticketing/token";

export type UnlockResult = { success: true } | { success: false; error: string };

const TEN_MINUTES = 10 * 60 * 1000;
const INVALID_LINK = "Este enlace ya no es válido.";
const TOO_MANY = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

export async function unlockDoor(key: string, pin: string, staffName: string): Promise<UnlockResult> {
  try {
    const name = parseStaffName(staffName);
    if ("error" in name) return { success: false, error: name.error };

    const ip = getClientIp(await headers());
    if (ip && !(await hitRateLimit(rateLimitKey("door-ip", ip), 20, TEN_MINUTES)).allowed) {
      return { success: false, error: TOO_MANY };
    }

    const access = await findActiveDoorAccess(key);
    if (!access) return { success: false, error: INVALID_LINK };
    if (!(await hitRateLimit(rateLimitKey("door-access", access.id), 40, TEN_MINUTES)).allowed) {
      return { success: false, error: TOO_MANY };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Reserve an attempt BEFORE the slow scrypt, in one conditional statement: it only
    // succeeds while the access is unlocked and under the failure budget, so parallel
    // guesses cannot exceed MAX_FAILED_ATTEMPTS and nothing runs scrypt once locked.
    const reserved = await prisma.$executeRaw`
      UPDATE "DoorAccess" SET "failedAttempts" = "failedAttempts" + 1
      WHERE "id" = ${access.id} AND "revokedAt" IS NULL
        AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${nowIso}::timestamp)
        AND "failedAttempts" < ${MAX_FAILED_ATTEMPTS}`;
    if (reserved !== 1) return { success: false, error: TOO_MANY };

    if (!(await verifyPin(typeof pin === "string" ? pin.trim() : "", access.pinHash))) {
      // Lock once the budget is spent. Guarded so a lock that already landed is never extended.
      const lockedUntil = nextLockout(MAX_FAILED_ATTEMPTS, now) as Date;
      const locked = await prisma.$executeRaw`
        UPDATE "DoorAccess" SET "lockedUntil" = ${lockedUntil.toISOString()}::timestamp, "failedAttempts" = 0
        WHERE "id" = ${access.id} AND "failedAttempts" >= ${MAX_FAILED_ATTEMPTS}
          AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${nowIso}::timestamp)`;
      return { success: false, error: locked === 1 ? TOO_MANY : "PIN incorrecto." };
    }

    // Correct PIN: reset only if no lock landed meanwhile and the access is still active.
    const reset = await prisma.$executeRaw`
      UPDATE "DoorAccess" SET "failedAttempts" = 0, "lockedUntil" = NULL
      WHERE "id" = ${access.id} AND "revokedAt" IS NULL
        AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${nowIso}::timestamp)`;
    if (reset !== 1) return { success: false, error: TOO_MANY };

    const exp = now.getTime() + DOOR_SESSION_MS;
    const token = signDoorSession(
      { accessId: access.id, version: access.sessionVersion, name: name.name, exp },
      getTicketingEnv().signingSecret,
    );
    (await cookies()).set(DOOR_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: doorCookiePath(key),
      expires: new Date(exp),
    });
    revalidatePath(doorCookiePath(key));
    return { success: true };
  } catch (error) {
    console.error("Error unlocking door:", error);
    return { success: false, error: "No se pudo verificar el acceso. Inténtalo de nuevo." };
  }
}

export async function logoutDoor(key: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) return;
  (await cookies()).set(DOOR_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: doorCookiePath(key),
    maxAge: 0,
  });
  revalidatePath(doorCookiePath(key));
}

// ---------------------------------------------------------------------------
// Check-in console. Every action resolves the door session first; the event is
// ALWAYS taken from the session, never from client input.
// ---------------------------------------------------------------------------

const EXPIRED = "Sesión expirada";
const SEARCH_LIMIT = 10;
const NOT_FOUND = "Boleto no encontrado para este evento";

const TICKET_SELECT = {
  id: true,
  eventId: true,
  code: true,
  name: true,
  status: true,
  paymentMethod: true,
  answers: true,
  checkedInAt: true,
  checkedInBy: true,
} as const;

export interface DoorLookupEntry {
  ticket: DoorTicketView;
  decision: CheckInDecision;
}

export type LookupResult = { success: true; entries: DoorLookupEntry[] } | { success: false; error: string; code?: DoorErrorCode };
export type CheckInResult =
  | { success: true; ticket: DoorTicketView }
  | { success: false; error: string; code?: DoorErrorCode; ticket?: DoorTicketView; decision?: CheckInDecision };
export type WalkInResult =
  | { success: true; ticket: DoorTicketView }
  | { success: false; error: string; code?: DoorErrorCode; fieldErrors?: Record<string, string>; duplicateEmail?: boolean };

type SessionOutcome =
  | { session: DoorSession; error?: undefined; code?: undefined }
  | { session?: undefined; error: string; code?: DoorErrorCode };

async function requireDoorSession(key: string, rateScope?: string): Promise<SessionOutcome> {
  const session = await getDoorSession(key);
  if (!session) return { error: EXPIRED, code: "SESSION_EXPIRED" };
  if (session.eventCancelled) return { error: "Evento cancelado", code: "EVENT_CANCELLED" };
  if (rateScope) {
    const ip = getClientIp(await headers());
    if (ip && !(await hitRateLimit(rateLimitKey(`${rateScope}-ip`, ip), 600, TEN_MINUTES)).allowed) {
      return { error: TOO_MANY };
    }
    if (!(await hitRateLimit(rateLimitKey(`${rateScope}-access`, session.access.id), 600, TEN_MINUTES)).allowed) {
      return { error: TOO_MANY };
    }
  }
  return { session };
}

function toEntry(ticket: Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>, eventId: string): DoorLookupEntry {
  return { ticket: toDoorTicketView(ticket), decision: checkInDecision(ticket, eventId) };
}

/** Scan or manual short code: resolves exactly one ticket of the session's event. */
export async function lookupTicket(key: string, input: string): Promise<LookupResult> {
  try {
    const outcome = await requireDoorSession(key, "door-lookup");
    if (outcome.error !== undefined) return { success: false, error: outcome.error, code: outcome.code };
    const { session } = outcome;

    const parsed = parseScanInput(typeof input === "string" ? input : "", getTicketingEnv().signingSecret);
    if (parsed.kind === "invalid") return { success: false, error: "Código no válido" };

    // Scoping by eventId in the query makes another event's ticket indistinguishable from a missing one.
    const where = parsed.kind === "ticket" ? { id: parsed.ticketId } : { code: parsed.code };
    const ticket = await prisma.ticket.findFirst({
      where: { ...where, eventId: session.access.eventId },
      select: TICKET_SELECT,
    });
    if (!ticket) return { success: false, error: NOT_FOUND };
    return { success: true, entries: [toEntry(ticket, session.access.eventId)] };
  } catch (error) {
    console.error("Error looking up ticket:", error);
    return { success: false, error: "No se pudo consultar el boleto. Inténtalo de nuevo." };
  }
}

/** Search by name or short code within the session's event. */
export async function searchTickets(key: string, query: string): Promise<LookupResult> {
  try {
    const outcome = await requireDoorSession(key, "door-lookup");
    if (outcome.error !== undefined) return { success: false, error: outcome.error, code: outcome.code };
    const { session } = outcome;

    const q = parseSearchQuery(typeof query === "string" ? query : "");
    if (!q) return { success: false, error: "Escribe al menos 2 caracteres" };

    const tickets = await prisma.ticket.findMany({
      where: {
        eventId: session.access.eventId,
        OR: [
          { name: { contains: escapeLike(q.text), mode: "insensitive" } },
          ...(q.code ? [{ code: { startsWith: q.code } }] : []),
        ],
      },
      select: TICKET_SELECT,
      orderBy: { name: "asc" },
      take: SEARCH_LIMIT,
    });
    return { success: true, entries: tickets.map((t) => toEntry(t, session.access.eventId)) };
  } catch (error) {
    console.error("Error searching tickets:", error);
    return { success: false, error: "No se pudo buscar. Inténtalo de nuevo." };
  }
}

/** Single conditional update: of N simultaneous calls exactly one flips PAID -> CHECKED_IN. */
export async function checkIn(key: string, ticketId: string): Promise<CheckInResult> {
  try {
    const outcome = await requireDoorSession(key);
    if (outcome.error !== undefined) return { success: false, error: outcome.error, code: outcome.code };
    const { session } = outcome;
    if (typeof ticketId !== "string" || ticketId.length === 0 || ticketId.length > 100) {
      return { success: false, error: NOT_FOUND };
    }

    const { count } = await prisma.ticket.updateMany({
      where: { id: ticketId, eventId: session.access.eventId, status: "PAID", event: { isCancelled: false } },
      data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInBy: session.staffName },
    });

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, eventId: session.access.eventId },
      select: TICKET_SELECT,
    });
    if (!ticket) return { success: false, error: NOT_FOUND };
    if (count === 1) return { success: true, ticket: toDoorTicketView(ticket) };

    const decision = checkInDecision(ticket, session.access.eventId, { eventCancelled: session.eventCancelled });
    return {
      success: false,
      error: decision.kind === "allow" ? "No se pudo registrar el acceso. Inténtalo de nuevo." : decision.message,
      ticket: toDoorTicketView(ticket),
      decision,
    };
  } catch (error) {
    console.error("Error checking in:", error);
    return { success: false, error: "No se pudo registrar el acceso. Inténtalo de nuevo." };
  }
}

class EmailTaken extends Error {}

const BLOCKING_STATUSES = ORDER_STATUSES.filter(blocksWalkIn);

/**
 * Cash walk-in: price and allowCash are read server-side; capacity is ignored by design.
 * Creates a PAID cash Order (quantity 1) and its CHECKED_IN ticket in one transaction;
 * they share id and code, the same shape as a backfilled legacy purchase.
 */
export async function createWalkIn(key: string, input: unknown): Promise<WalkInResult> {
  try {
    const outcome = await requireDoorSession(key, "door-walkin");
    if (outcome.error !== undefined) return { success: false, error: outcome.error, code: outcome.code };
    const { session } = outcome;

    const parsed = parseWalkIn(input);
    if (parsed.errors) return { success: false, error: "Revisa los campos marcados.", fieldErrors: parsed.errors };
    const { name, email, phone } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: session.access.eventId },
      select: { allowCash: true, priceCents: true, currency: true, isCancelled: true },
    });
    if (!event || event.isCancelled) return { success: false, error: "Este evento ya no está disponible." };
    if (!event.allowCash) return { success: false, error: "El pago en efectivo no está habilitado para este evento." };

    const status = initialStatus({ method: "CASH", priceCents: event.priceCents, channel: "door" });
    const answers = phone ? { phone: { label: "Teléfono", value: phone } } : {};

    const created = await createWithUniqueCode(
      () => generateShortCode(randomInt),
      async (code) => {
        const id = randomUUID();
        return await prisma.$transaction(async (tx) => {
          // Same per-event lock as registration, so the email check below cannot race a public order.
          await lockEvent(tx, session.access.eventId);
          if (email) {
            const taken = await tx.order.findFirst({
              where: { eventId: session.access.eventId, email, status: { in: BLOCKING_STATUSES } },
              select: { id: true },
            });
            if (taken) throw new EmailTaken();
          }
          await tx.order.create({
            data: {
              id,
              eventId: session.access.eventId,
              code,
              name,
              email,
              answers,
              quantity: 1,
              unitPriceCents: event.priceCents,
              amountCents: event.priceCents,
              currency: event.currency,
              paymentMethod: "CASH",
              status: "PAID",
            },
          });
          return tx.ticket.create({
            data: {
              id,
              orderId: id,
              seq: 1,
              eventId: session.access.eventId,
              code,
              name,
              email,
              answers,
              status,
              paymentMethod: "CASH",
              amountCents: event.priceCents,
              currency: event.currency,
              checkedInAt: new Date(),
              checkedInBy: session.staffName,
            },
            select: TICKET_SELECT,
          });
        });
      },
      isUniqueViolation,
    );
    return { success: true, ticket: toDoorTicketView(created) };
  } catch (error) {
    if (error instanceof EmailTaken) {
      return { success: false, error: "Ese correo ya tiene boleto. Búscalo por nombre o código.", duplicateEmail: true };
    }
    console.error("Error creating walk-in:", error);
    return { success: false, error: "No se pudo registrar al asistente. Inténtalo de nuevo." };
  }
}
