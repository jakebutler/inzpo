import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/auth/clerk-configured";
import { isDevAuthBypassEnabled, isFoldQaEnabled } from "@/lib/auth/dev-bypass";

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/share",
  "/api/reaper",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
]);
const isDevQaRoute = createRouteMatcher(["/dev(.*)"]);

function loginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const destination = request.nextUrl.pathname + request.nextUrl.search;
  if (destination !== "/") loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  const { userId } = await auth();
  if (!userId) return loginRedirect(request);
});

export default function middleware(request: NextRequest, event: unknown) {
  if (isDevAuthBypassEnabled()) return NextResponse.next();
  if (isFoldQaEnabled() && isDevQaRoute(request)) return NextResponse.next();
  if (!isClerkConfigured()) {
    if (isPublicRoute(request)) return NextResponse.next();
    return loginRedirect(request);
  }
  return clerkHandler(request, event as never);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
