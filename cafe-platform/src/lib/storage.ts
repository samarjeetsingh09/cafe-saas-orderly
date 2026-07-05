import { randomBytes } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

/**
 * Pluggable image storage (Security doc 5.9: server-side type + size
 * validation). Current driver = local disk under <project>/uploads,
 * served via /api/images/[...path]. Swapping to Supabase Storage later
 * means reimplementing saveMenuPhoto() only — callers keep the URL.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

/** Sniff real image type from magic bytes — never trust the client's MIME. */
export function sniffImageType(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Store a validated menu photo; returns the public URL path. */
export async function saveMenuPhoto(cafeId: string, buf: Buffer): Promise<{ url: string } | { error: string }> {
  if (buf.length > MAX_PHOTO_BYTES) return { error: "Photo is too big — keep it under 2 MB." };
  const type = sniffImageType(buf);
  if (!type) return { error: "That file isn't a photo. Use JPG, PNG or WebP." };

  const name = `${randomBytes(12).toString("hex")}.${type}`;
  const dir = path.join(UPLOADS_ROOT, "menu", cafeId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return { url: `/api/images/menu/${cafeId}/${name}` };
}

/** Read a stored image for serving; null when missing or path escapes root. */
export async function readStoredImage(segments: string[]): Promise<{ body: Buffer; contentType: string } | null> {
  const rel = path.normalize(segments.join("/"));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const ext = rel.split(".").pop() ?? "";
  const contentType = IMAGE_CONTENT_TYPES[ext];
  if (!contentType) return null;
  try {
    const body = await readFile(path.join(UPLOADS_ROOT, rel));
    return { body, contentType };
  } catch {
    return null;
  }
}
