import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRODUCTION_HOST = "sistemas-de-eventos.vercel.app";
const PRODUCTION_URL = `https://${PRODUCTION_HOST}`;

export function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase();

  if (host === PRODUCTION_HOST) {
    return NextResponse.next();
  }

  if (host.endsWith(".vercel.app") && host.startsWith("sistemas-de-eventos")) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, PRODUCTION_URL);
    return NextResponse.redirect(url, 302);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
