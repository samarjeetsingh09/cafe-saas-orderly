import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PLATFORM_COOKIE, PROFILE_COOKIE } from "@/lib/auth";

/** Clears both session cookies; safe to call from either portal. */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(PROFILE_COOKIE);
  cookieStore.delete(PLATFORM_COOKIE);
  return NextResponse.json({ ok: true });
}
