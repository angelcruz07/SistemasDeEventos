"use client"

import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // Usar el mismo origen que la página evita "Failed to fetch" (p. ej. 127.0.0.1 vs localhost)
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
})

export const { signIn, signUp, signOut, useSession } = authClient
