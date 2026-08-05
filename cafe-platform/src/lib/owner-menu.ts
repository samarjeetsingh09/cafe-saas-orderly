import { prisma } from "@/lib/db";
import type { CustomerCategoryDTO } from "@/lib/menu";

/**
 * Menu manager data (Phase H #1) — reuses the exact same DTO shape
 * `lib/menu.ts` built for the customer page (id/name/description/isVeg/
 * available/variants already has everything the editor needs to render and
 * mutate). Unlike `getCustomerMenu`, empty categories aren't filtered out —
 * the owner needs to see a just-created category to add its first dish.
 */
export async function getMenuManagerData(tenantId: string): Promise<CustomerCategoryDTO[]> {
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

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    isVeg: c.isVeg,
    art: "leaf",
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
