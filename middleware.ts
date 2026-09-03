import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;
  if (valid) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const destination = request.nextUrl.pathname + request.nextUrl.search;
  if (destination !== "/") loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|share|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
