import { cookies } from "next/headers";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { hashDoorKey, sessionMatchesAccess } from "@/lib/ticketing/door-pin";
import { toDoorEventView, type DoorEventView } from "@/lib/ticketing/door-view";
import { verifyDoorSession } from "@/lib/ticketing/token";

export const DOOR_COOKIE = "door_session";
export const DOOR_SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 100;

export function doorCookiePath(key: string): string {
  return `/door/${key}`;
}

/** Looks up a non-revoked access by raw link key. Unknown and revoked are indistinguishable (null). */
export async function findActiveDoorAccess(key: string) {
  if (!key || key.length > MAX_KEY_LENGTH) return null;
  const access = await prisma.doorAccess.findUnique({ where: { keyHash: hashDoorKey(key) } });
  return access && access.revokedAt === null ? access : null;
}

export interface DoorSession {
  access: { id: string; eventId: string };
  /** Staff-safe fields only: no prices, SPEI data, capacity or settings. */
  event: DoorEventView;
  staffName: string;
}

/**
 * Resolves the current staff session for a door link, or null. The signed cookie
 * must be unexpired, belong to this access and carry the current sessionVersion,
 * so regenerating or revoking the access invalidates every phone at once.
 * Every door page and action must call this; PR8 builds on it.
 */
export async function getDoorSession(key: string): Promise<DoorSession | null> {
  const access = await findActiveDoorAccess(key);
  if (!access) return null;

  const token = (await cookies()).get(DOOR_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyDoorSession(token, getTicketingEnv().signingSecret, new Date());
  if (!payload || !sessionMatchesAccess(payload, access)) return null;

  const event = await prisma.event.findUnique({
    where: { id: access.eventId },
    select: { id: true, title: true, date: true, time: true, location: true },
  });
  if (!event) return null;

  return {
    access: { id: access.id, eventId: access.eventId },
    event: toDoorEventView(event),
    staffName: payload.name,
  };
}
