"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { DOOR_COOKIE, DOOR_SESSION_MS, doorCookiePath, findActiveDoorAccess } from "@/lib/server/door-session";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
import { isLocked, nextLockout, parseStaffName, verifyPin } from "@/lib/ticketing/door-pin";
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
    if (isLocked(access.lockedUntil, now)) return { success: false, error: TOO_MANY };

    if (!(await verifyPin(typeof pin === "string" ? pin.trim() : "", access.pinHash))) {
      // Atomic increment: concurrent wrong guesses cannot undercount.
      const { failedAttempts } = await prisma.doorAccess.update({
        where: { id: access.id },
        data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true },
      });
      const lockedUntil = nextLockout(failedAttempts, now);
      if (lockedUntil) {
        await prisma.doorAccess.update({ where: { id: access.id }, data: { lockedUntil, failedAttempts: 0 } });
        return { success: false, error: TOO_MANY };
      }
      return { success: false, error: "PIN incorrecto." };
    }

    if (access.failedAttempts > 0 || access.lockedUntil) {
      await prisma.doorAccess.update({ where: { id: access.id }, data: { failedAttempts: 0, lockedUntil: null } });
    }

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
