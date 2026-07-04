import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/**
 * Auth primitives — Security_Access_Document.md Section 2.
 * Owner JWT carries cafe_id (scopes every owner API query);
 * admin JWT carries role. Both are httpOnly cookies, never localStorage.
 */

const JWT_EXPIRY = "3d"; // Security doc 2.4: expiry a few days

export const OWNER_COOKIE = "owner_session";
export const ADMIN_COOKIE = "admin_session";

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

export type OwnerClaims = { kind: "owner"; cafe_id: string };
export type AdminClaims = { kind: "admin"; admin_id: string; role: string };

export function signOwnerToken(cafeId: string): string {
  const claims: OwnerClaims = { kind: "owner", cafe_id: cafeId };
  return jwt.sign(claims, secret(), { expiresIn: JWT_EXPIRY });
}

export function signAdminToken(adminId: string, role: string): string {
  const claims: AdminClaims = { kind: "admin", admin_id: adminId, role };
  return jwt.sign(claims, secret(), { expiresIn: JWT_EXPIRY });
}

export function verifyOwnerToken(token: string): OwnerClaims | null {
  try {
    const payload = jwt.verify(token, secret()) as OwnerClaims;
    return payload.kind === "owner" && typeof payload.cafe_id === "string" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token: string): AdminClaims | null {
  try {
    const payload = jwt.verify(token, secret()) as AdminClaims;
    return payload.kind === "admin" && typeof payload.admin_id === "string" ? payload : null;
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
