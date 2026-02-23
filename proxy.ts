import { NextRequest, NextResponse } from "next/server"

const protectedRoutes = ["/dashboard"]
const authRoutes = ["/login", "/register"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  const sessionCookie = request.cookies.get("better-auth.session_token")?.value
  const isAuthenticated = !!sessionCookie

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
}
