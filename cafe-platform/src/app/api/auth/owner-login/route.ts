import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  DUMMY_BCRYPT_HASH,
  PROFILE_COOKIE,
  sessionCookieOptions,
  signProfileToken,
  verifyPassword,
} from "@/lib/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

/**
 * Cafe staff login (owner/manager/waiter/kitchen — one page, role decides
 * what they see): email + password → JWT scoped to tenant_id + role.
 * Generic error message for every failure mode — never reveal whether the
 * email exists or the account/tenant is disabled.
 */
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

  const lockKey = `profile:${email}`;
  if (isLocked(lockKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const profile = await prisma.profile.findUnique({ where: { email }, include: { tenant: true } });

  // Always run bcrypt so a missing account takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, profile?.passwordHash ?? DUMMY_BCRYPT_HASH);

  if (!profile || !passwordOk || !profile.active || profile.tenant.status === "cancelled") {
    recordFailure(lockKey);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  recordSuccess(lockKey);
  const cookieStore = await cookies();
  cookieStore.set(
    PROFILE_COOKIE,
    signProfileToken(profile.id, profile.tenantId, profile.role),
    sessionCookieOptions(),
  );
  return NextResponse.json({ ok: true, fullName: profile.fullName, role: profile.role, tenantName: profile.tenant.name });
}
