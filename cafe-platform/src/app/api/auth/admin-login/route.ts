import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  DUMMY_BCRYPT_HASH,
  PLATFORM_COOKIE,
  sessionCookieOptions,
  signPlatformToken,
  verifyPassword,
} from "@/lib/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

/** HQ/platform staff login — fully separate flow, cookie and table from cafe staff login. */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const lockKey = `platform:${email}`;
  if (isLocked(lockKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const user = await prisma.platformUser.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_BCRYPT_HASH);

  if (!user || !passwordOk || !user.active) {
    recordFailure(lockKey);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  recordSuccess(lockKey);
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_COOKIE, signPlatformToken(user.id, user.role), sessionCookieOptions());
  await prisma.platformUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return NextResponse.json({ ok: true, fullName: user.fullName });
}
