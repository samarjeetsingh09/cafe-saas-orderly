import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM at-rest encryption for gateway secrets (HQ-PORTAL-SPEC.md §6/§13).
 * `CONFIG_ENC_KEY` is a 32-byte key, hex-encoded, from `.env` — a dummy value
 * locally since Phase I never calls a real gateway. Output is a single
 * string `iv:authTag:ciphertext` (all hex) so it fits in one text column.
 */
function key(): Buffer {
  const hex = process.env.CONFIG_ENC_KEY;
  if (!hex) throw new Error("CONFIG_ENC_KEY is not set");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("CONFIG_ENC_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(enc: string): string {
  const [ivHex, tagHex, dataHex] = enc.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

/** Masked display for the UI, e.g. "rzp_live_4417" -> "rzp_live_••••4417". Never returns the real value. */
export function maskSecret(plain: string): string {
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}
