import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { PLATFORM_COOKIE, PROFILE_COOKIE, verifyPlatformToken, verifyProfileToken } from "@/lib/auth";
import type { Profile, PlatformUser, Tenant } from "@prisma/client";

/**
 * Per-request session resolution for server components and API routes
 * (Phase C rewrite). This is the belt on top of proxy.ts's suspenders: it
 * re-reads the profile/tenant row so a deactivated staff account or a
 * cancelled tenant's still-unexpired JWT is rejected on its next request.
 */

export type ProfileSession = Profile & { tenant: Tenant; impersonatedBy: string | null };

/** Cached per-request: layout and page both call this without a double DB round-trip. */
export const getProfile = cache(async (): Promise<ProfileSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(PROFILE_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyProfileToken(token);
  if (!claims) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: claims.profile_id },
    include: { tenant: true },
  });
  if (!profile || !profile.active) return null;
  if (profile.tenant.status === "cancelled") return null;
  return { ...profile, impersonatedBy: claims.impersonated_by ?? null };
});

export async function getPlatformUser(): Promise<PlatformUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyPlatformToken(token);
  if (!claims) return null;
  const user = await prisma.platformUser.findUnique({ where: { id: claims.platform_user_id } });
  if (!user || !user.active) return null;
  return user;
}

/** Throwing variants for API routes — catch and map to 401. */
export class UnauthorizedError extends Error {}

export async function requireProfile(): Promise<ProfileSession> {
  const profile = await getProfile();
  if (!profile) throw new UnauthorizedError("Staff session required");
  return profile;
}

export async function requirePlatformUser(): Promise<PlatformUser> {
  const user = await getPlatformUser();
  if (!user) throw new UnauthorizedError("Platform session required");
  return user;
}
