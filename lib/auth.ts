import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import prisma from "@/app/lib/prisma";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
const isProduction = baseURL.startsWith("https://");

export const auth = betterAuth({
  appName: "Sistema de Reservas",
  baseURL,
  trustedOrigins: [
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter(Boolean) as string[],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    // cookieCache deshabilitado: con enabled=true, getSession() en RSC puede devolver null en producción (bug better-auth #7008)
    // cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    useSecureCookies: isProduction,
    cookies: {
      session_token: {
        attributes: {
          path: "/",
          sameSite: "lax",
        },
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const userCount = await prisma.user.count();
          return {
            data: {
              ...user,
              role: userCount === 0 ? "admin" : "user",
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
