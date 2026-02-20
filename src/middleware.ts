import { NextRequest, NextResponse } from "next/server";
import { getCanonicalOrigin } from "@/lib/url";

function shouldSkip(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  );
}

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (shouldSkip(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const canonical = getCanonicalOrigin();
  if (!canonical) {
    return NextResponse.next();
  }

  const canonicalUrl = new URL(canonical);
  const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!requestHost) {
    return NextResponse.next();
  }

  if (requestHost === canonicalUrl.host) {
    return NextResponse.next();
  }

  const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalUrl.origin);
  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
