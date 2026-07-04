import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, OWNER_COOKIE, verifyAdminToken, verifyOwnerToken } from "@/lib/auth";

/**
 * Route guard for /owner/* and /admin/* — redirect to the matching login page
 * when there is no valid session JWT. Fast, DB-free check; the
 * deactivated-cafe re-check happens in requireOwner() (src/lib/session.ts)
 * on every data request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/owner")) {
    const token = request.cookies.get(OWNER_COOKIE)?.value;
    const claims = token ? verifyOwnerToken(token) : null;
    const isLogin = pathname === "/owner/login";

    if (!claims && !isLogin) {
      return NextResponse.redirect(new URL("/owner/login", request.url));
    }
    if (claims && isLogin) {
      return NextResponse.redirect(new URL("/owner/home", request.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const claims = token ? verifyAdminToken(token) : null;
    const isLogin = pathname === "/admin/login";

    if (!claims && !isLogin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (claims && isLogin) {
      return NextResponse.redirect(new URL("/admin/cafes", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/admin/:path*"],
};
