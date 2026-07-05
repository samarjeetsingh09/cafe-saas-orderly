import { prisma } from "@/lib/db";
import type { MenuCategoryDTO, MenuItemDTO } from "@/lib/menu";

/**
 * Owner menu management (M6). Unlike the customer fetch, empty categories
 * are kept (the owner just created one and needs to add dishes to it).
 * Every mutation is explicitly cafe-scoped — belt on the RLS suspenders.
 */

export async function getOwnerMenu(cafeId: string): Promise<MenuCategoryDTO[]> {
  const categories = await prisma.category.findMany({
    where: { cafeId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      menuItems: {
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          photoUrl: true,
          isVeg: true,
          isAvailable: true,
        },
      },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.menuItems.map((i) => ({ ...i, price: i.price.toNumber() })),
  }));
}

/* ── Field validation (shared by the category/menu-item routes) ────── */

export function cleanName(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= max ? s : null;
}

/** Optional description: null clears it, "invalid" rejects the request. */
export function cleanDescription(v: unknown): string | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const s = v.trim();
  if (s.length > 300) return "invalid";
  return s || null;
}

/** Price in rupees: positive, ≤ 1,00,000, at most 2 decimals. */
export function cleanPrice(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
}

/** Optional photo URL (Supabase upload lands later; URL field for now). */
export function cleanPhotoUrl(v: unknown): string | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > 500) return "invalid";
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : "invalid";
  } catch {
    return "invalid";
  }
}

export function serializeItem(i: {
  id: string;
  name: string;
  description: string | null;
  price: { toNumber(): number };
  photoUrl: string | null;
  isVeg: boolean;
  isAvailable: boolean;
}): MenuItemDTO {
  return { ...i, price: i.price.toNumber() };
}
