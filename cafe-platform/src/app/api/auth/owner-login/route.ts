import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  DUMMY_BCRYPT_HASH,
  OWNER_COOKIE,
  sessionCookieOptions,
  signOwnerToken,
  verifyPassword,
} from "@/lib/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

/**
 * Owner login: phone + password → JWT scoped to cafe_id (httpOnly cookie).
 * Generic error message for every failure mode — never reveal whether the
 * phone exists or the account is disabled (Security doc 5.5).
 */
export async function POST(request: Request) {
  let body: { phone?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!phone || !password) {
    return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
  }

  const lockKey = `owner:${phone}`;
  if (isLocked(lockKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const cafe = await prisma.cafe.findUnique({ where: { phone } });

  // Always run bcrypt so a missing account takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, cafe?.passwordHash ?? DUMMY_BCRYPT_HASH);

  // Offboarded cafes can't log in; expired ones still can (they need Billing).
  if (!cafe || !passwordOk || cafe.subscriptionStatus === "disabled") {
    recordFailure(lockKey);
    return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
  }

  recordSuccess(lockKey);
  const cookieStore = await cookies();
  cookieStore.set(OWNER_COOKIE, signOwnerToken(cafe.id), sessionCookieOptions());
  return NextResponse.json({ ok: true, cafeName: cafe.name });
}
