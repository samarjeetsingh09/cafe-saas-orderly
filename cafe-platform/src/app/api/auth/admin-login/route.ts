import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  ADMIN_COOKIE,
  DUMMY_BCRYPT_HASH,
  sessionCookieOptions,
  signAdminToken,
  verifyPassword,
} from "@/lib/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

/** Founder/admin login — separate flow and cookie from owner login. */
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

  const lockKey = `admin:${phone}`;
  if (isLocked(lockKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const admin = await prisma.admin.findUnique({ where: { phone } });
  const passwordOk = await verifyPassword(password, admin?.passwordHash ?? DUMMY_BCRYPT_HASH);

  if (!admin || !passwordOk) {
    recordFailure(lockKey);
    return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
  }

  recordSuccess(lockKey);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, signAdminToken(admin.id, admin.role), sessionCookieOptions());
  return NextResponse.json({ ok: true, name: admin.name });
}
