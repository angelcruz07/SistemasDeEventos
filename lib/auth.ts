import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import prisma from "@/app/lib/prisma";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: (request) => {
    const origins: string[] = [
      "https://sistemas-de-eventos.vercel.app",
      "http://localhost:3000",
    ];
    if (process.env.VERCEL_URL) {
      origins.push(`https://${process.env.VERCEL_URL}`);
    }
    const originHeader = request?.headers?.get?.("origin") ?? request?.headers?.get?.("referer");
    if (originHeader) {
      try {
        const url = new URL(originHeader.startsWith("http") ? originHeader : `https://${originHeader}`);
        const host = url.hostname.toLowerCase();
        if (
          host === "sistemas-de-eventos.vercel.app" ||
          host.endsWith(".vercel.app") ||
          host === "localhost"
        ) {
          origins.push(url.origin);
        }
      } catch {
        // ignore invalid URL
      }
    }
    return origins;
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
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
