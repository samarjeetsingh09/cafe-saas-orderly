import { NextResponse } from "next/server";
import { requirePlatformUser, UnauthorizedError } from "@/lib/session";
import { canHq, type HqCapability } from "@/lib/hq-permissions";
import type { PlatformUser } from "@prisma/client";

/**
 * Shared `/api/admin/*` guard. 404 here too (not 401/403) would be more
 * consistent with proxy.ts's "don't confirm the route exists" rule, but
 * proxy.ts already blocks the page shell for non-platform sessions before
 * any fetch reaches these routes — a 401/403 from an authenticated-but-
 * under-privileged platform user is fine to reveal, it's just not enough.
 */
export async function requireHq(capability: HqCapability): Promise<{ user: PlatformUser } | { error: NextResponse }> {
  let user: PlatformUser;
  try {
    user = await requirePlatformUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return { error: NextResponse.json({ error: "Platform session required" }, { status: 401 }) };
    }
    throw e;
  }
  if (!canHq(user.role, capability)) {
    return { error: NextResponse.json({ error: "Not permitted" }, { status: 403 }) };
  }
  return { user };
}
