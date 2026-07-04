import { randomBytes, randomUUID } from "crypto";

const ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * URL-safe random token. Default 16 chars (~82 bits) — used for table QR tokens
 * and customer session tokens. Format is FROZEN once QR stickers are printed (M9).
 */
export function randomToken(length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
  }
  return out;
}

/** Order confirmation token — UUID, used only in the customer status-page URL. */
export function confirmationToken(): string {
  return randomUUID();
}
