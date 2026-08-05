import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PLATFORM_COOKIE, PROFILE_COOKIE, verifyPlatformToken, verifyProfileToken } from "@/lib/auth";

/**
 * Route guard for /owner/* and /admin/* (Phase C rewrite). Fast, DB-free JWT
 * check; the deactivated-account/tenant re-check happens in requireProfile()/
 * requirePlatformUser() (src/lib/session.ts) on every data request.
 *
 * /admin/* (HQ) is deliberately 404, not redirect, for anyone without a valid
 * platform session — including a perfectly valid owner/profile session. Don't
 * confirm the route exists to a session that isn't platform staff
 * (HQ-PORTAL-SPEC.md §1).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/owner")) {
    const token = request.cookies.get(PROFILE_COOKIE)?.value;
    const claims = token ? verifyProfileToken(token) : null;
    const isLogin = pathname === "/owner/login";

    if (!claims && !isLogin) {
      return NextResponse.redirect(new URL("/owner/login", request.url));
    }
    if (claims && isLogin) {
      return NextResponse.redirect(new URL("/owner/orders", request.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    const isLogin = pathname === "/admin/login";
    const token = request.cookies.get(PLATFORM_COOKIE)?.value;
    const claims = token ? verifyPlatformToken(token) : null;

    if (isLogin) {
      if (claims) return NextResponse.redirect(new URL("/admin", request.url));
      return NextResponse.next();
    }
    if (!claims) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/admin/:path*"],
};
