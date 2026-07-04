import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, OWNER_COOKIE } from "@/lib/auth";

/** Clears both session cookies; safe to call from either portal. */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(OWNER_COOKIE);
  cookieStore.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
