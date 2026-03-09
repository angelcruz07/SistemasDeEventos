import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

const protectedRoutes = ["/dashboard"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const sessionCookie = getSessionCookie(request)
  const isAuthenticated = !!sessionCookie

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // No redirigir a /dashboard solo por tener cookie: la cookie puede estar expirada/inválida
  // y provocaría bucle con el layout del dashboard (getSession null -> redirect login -> proxy -> dashboard).
  // Si ya hay sesión válida, el layout de (auth) redirige a /dashboard.
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
}
