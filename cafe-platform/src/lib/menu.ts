import { prisma } from "@/lib/db";

/**
 * Table/menu resolution for the customer app (Phase F) —
 * plan/bella-ordering-prototype_1.html ported to `/t/[token]`.
 */

/** Decorative dish-category icon set from the prototype (generic line art,
 *  not cafe branding) — rotated by position so it never has to know a
 *  cafe's actual category names (Rule 2). */
const ART_KEYS = ["leaf", "plate", "bowl", "cake", "cup", "pizza"] as const;
export type ArtKey = (typeof ART_KEYS)[number];

export type ResolvedTable = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantTagline: string | null;
  theme: unknown;
  gstPercent: number;
  tableId: string;
  tableLabel: string;
  ordersOpen: boolean;
};

/** Resolves a table QR token to its tenant. Never accept a tenantId from the client instead. */
export async function resolveTable(qrToken: string): Promise<ResolvedTable | null> {
  const table = await prisma.cafeTable.findUnique({
    where: { qrToken },
    select: {
      id: true,
      label: true,
      active: true,
      tenant: { select: { id: true, slug: true, name: true, tagline: true, theme: true, gstPercent: true, status: true } },
    },
  });
  if (!table) return null;

  // Fire-and-forget scan count for the QR tab's analytics (Phase H) — never block the menu on this.
  prisma.cafeTable.update({ where: { id: table.id }, data: { scans: { increment: 1 } } }).catch(() => {});

  return {
    tenantId: table.tenant.id,
    tenantSlug: table.tenant.slug,
    tenantName: table.tenant.name,
    tenantTagline: table.tenant.tagline,
    theme: table.tenant.theme,
    gstPercent: Number(table.tenant.gstPercent),
    tableId: table.id,
    tableLabel: table.label,
    ordersOpen: table.active && table.tenant.status !== "paused" && table.tenant.status !== "cancelled",
  };
}

export type CustomerVariantDTO = { id: string; label: string; pricePaise: number };
export type CustomerItemDTO = {
  id: string;
  name: string;
  description: string | null;
  isVeg: boolean;
  available: boolean;
  variants: CustomerVariantDTO[];
};
export type CustomerCategoryDTO = {
  id: string;
  name: string;
  isVeg: boolean;
  art: ArtKey;
  items: CustomerItemDTO[];
};

export async function getCustomerMenu(tenantId: string): Promise<CustomerCategoryDTO[]> {
  const categories = await prisma.category.findMany({
    where: { tenantId, active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: {
        orderBy: { sortOrder: "asc" },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return categories
    .filter((c) => c.menuItems.length > 0)
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      isVeg: c.isVeg,
      art: ART_KEYS[i % ART_KEYS.length],
      items: c.menuItems.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description,
        isVeg: it.isVeg,
        available: it.available,
        variants: it.variants.map((v) => ({ id: v.id, label: v.label, pricePaise: v.pricePaise })),
      })),
    }));
}
