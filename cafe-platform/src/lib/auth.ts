import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/**
 * Auth primitives (Phase C rewrite — Tenant/Profile schema).
 * Profile JWT carries tenant_id + role (any cafe staff: owner/manager/waiter/
 * kitchen, same login page, role decides what they see). PlatformUser JWT is
 * a fully separate cookie/claim shape — HQ staff can never be a role on
 * Profile, see plan/DECISIONS.md #4.
 */

const JWT_EXPIRY = "3d";

export const PROFILE_COOKIE = "profile_session";
export const PLATFORM_COOKIE = "platform_session";

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Constant-shape compare target when the account doesn't exist (timing parity). */
export const DUMMY_BCRYPT_HASH =
  "$2b$10$nXcM2L3ASFPyIzBxsu19ce6tJksycnrN0Qny89/AFRLtYb6GyPRc.";

export type ProfileClaims = {
  kind: "profile";
  profile_id: string;
  tenant_id: string;
  role: string;
  /** Set only for an HQ "login as owner" session — see lib/session.ts and ImpersonationBanner. */
  impersonated_by?: string;
};
export type PlatformClaims = { kind: "platform"; platform_user_id: string; role: string };

export function signProfileToken(profileId: string, tenantId: string, role: string): string {
  const claims: ProfileClaims = { kind: "profile", profile_id: profileId, tenant_id: tenantId, role };
  return jwt.sign(claims, secret(), { expiresIn: JWT_EXPIRY });
}

/** Impersonation session token — hard 60-minute cap, never the normal 3-day expiry. */
export function signImpersonationToken(profileId: string, tenantId: string, role: string, platformUserId: string): string {
  const claims: ProfileClaims = {
    kind: "profile",
    profile_id: profileId,
    tenant_id: tenantId,
    role,
    impersonated_by: platformUserId,
  };
  return jwt.sign(claims, secret(), { expiresIn: "60m" });
}

export function signPlatformToken(platformUserId: string, role: string): string {
  const claims: PlatformClaims = { kind: "platform", platform_user_id: platformUserId, role };
  return jwt.sign(claims, secret(), { expiresIn: JWT_EXPIRY });
}

export function verifyProfileToken(token: string): ProfileClaims | null {
  try {
    const payload = jwt.verify(token, secret()) as ProfileClaims;
    return payload.kind === "profile" && typeof payload.profile_id === "string" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyPlatformToken(token: string): PlatformClaims | null {
  try {
    const payload = jwt.verify(token, secret()) as PlatformClaims;
    return payload.kind === "platform" && typeof payload.platform_user_id === "string" ? payload : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 3 * 24 * 60 * 60,
  };
}

/** Matches signImpersonationToken's 60-minute expiry — cookie can't outlive the JWT. */
export function impersonationCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 60 * 60 };
}
