import { prisma } from "@/lib/db";

/**
 * SSR menu fetch for the customer app. Prices become plain numbers here —
 * Prisma Decimal doesn't cross the server/client component boundary.
 */

export type MenuItemDTO = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  isVeg: boolean;
  isAvailable: boolean;
};

export type MenuCategoryDTO = {
  id: string;
  name: string;
  items: MenuItemDTO[];
};

export type CafeMenuDTO = {
  cafeId: string;
  cafeName: string;
  slug: string;
  menuEnabled: boolean;
  categories: MenuCategoryDTO[];
};

export async function getMenuBySlug(slug: string): Promise<CafeMenuDTO | null> {
  const cafe = await prisma.cafe.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      menuEnabled: true,
      categories: {
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
      },
    },
  });
  if (!cafe) return null;

  return {
    cafeId: cafe.id,
    cafeName: cafe.name,
    slug: cafe.slug,
    menuEnabled: cafe.menuEnabled,
    categories: cafe.categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: c.menuItems.map((i) => ({ ...i, price: i.price.toNumber() })),
      }))
      .filter((c) => c.items.length > 0),
  };
}

/** Resolves a table QR token; returns null when the token doesn't exist. */
export async function getTableByToken(qrToken: string) {
  return prisma.table.findUnique({
    where: { qrToken },
    select: { id: true, tableNumber: true, cafeId: true, cafe: { select: { slug: true } } },
  });
}
