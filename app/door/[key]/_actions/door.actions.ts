"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { DOOR_COOKIE, DOOR_SESSION_MS, doorCookiePath, findActiveDoorAccess } from "@/lib/server/door-session";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
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
