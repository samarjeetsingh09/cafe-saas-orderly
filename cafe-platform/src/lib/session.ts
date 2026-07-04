import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, OWNER_COOKIE, verifyAdminToken, verifyOwnerToken } from "@/lib/auth";
import type { Cafe, Admin } from "@prisma/client";

/**
 * Per-request session resolution for server components and API routes.
 * This is the belt on top of the proxy's suspenders: it re-reads the cafe row
 * so a deactivated cafe's still-unexpired JWT is rejected on its next request
 * (BUILD_PLAN M2 session-invalidation requirement).
 */

export async function getOwnerCafe(): Promise<Cafe | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyOwnerToken(token);
  if (!claims) return null;

  const cafe = await prisma.cafe.findUnique({ where: { id: claims.cafe_id } });
  if (!cafe || cafe.subscriptionStatus === "disabled") return null;
  return cafe;
}

export async function getAdmin(): Promise<Admin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyAdminToken(token);
  if (!claims) return null;
  return prisma.admin.findUnique({ where: { id: claims.admin_id } });
}

/** Throwing variants for API routes — catch and map to 401. */
export class UnauthorizedError extends Error {}

export async function requireOwner(): Promise<Cafe> {
  const cafe = await getOwnerCafe();
  if (!cafe) throw new UnauthorizedError("Owner session required");
  return cafe;
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new UnauthorizedError("Admin session required");
  return admin;
}
