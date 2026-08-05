import { prisma } from "@/lib/db";

/** Templates (HQ-PORTAL-SPEC.md §7) — theme + default categories/items/variants + default settings. */
export type TemplateCategory = {
  name: string;
  isVeg: boolean;
  items: { name: string; description?: string; variants: { label: string; pricePaise: number }[] }[];
};
export type TemplateSettings = { gstPercent: number; splitKitchen: boolean; prepMinutes: number };

export type TemplateDTO = {
  id: string;
  name: string;
  description: string | null;
  theme: Record<string, string>;
  categories: TemplateCategory[];
  settings: TemplateSettings;
  createdAt: string;
  cafeCount: number;
};

export async function listTemplates(): Promise<TemplateDTO[]> {
  const rows = await prisma.cafeTemplate.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { tenants: true } } } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    theme: r.theme as Record<string, string>,
    categories: r.categories as unknown as TemplateCategory[],
    settings: r.settings as unknown as TemplateSettings,
    createdAt: r.createdAt.toISOString(),
    cafeCount: r._count.tenants,
  }));
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  theme: Record<string, string>;
  categories: TemplateCategory[];
  settings: TemplateSettings;
}): Promise<TemplateDTO> {
  const r = await prisma.cafeTemplate.create({
    data: { name: input.name, description: input.description, theme: input.theme, categories: input.categories, settings: input.settings },
  });
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    theme: r.theme as Record<string, string>,
    categories: r.categories as unknown as TemplateCategory[],
    settings: r.settings as unknown as TemplateSettings,
    createdAt: r.createdAt.toISOString(),
    cafeCount: 0,
  };
}

export async function deleteTemplate(id: string): Promise<void> {
  await prisma.cafeTemplate.delete({ where: { id } });
}

/** "Save this cafe as a template" (§7) — snapshots a live tenant's theme/menu/settings. */
export async function snapshotCafeAsTemplate(tenantId: string, name: string, description?: string): Promise<TemplateDTO> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: { categories: { orderBy: { sortOrder: "asc" }, include: { menuItems: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } } } } },
  });

  const categories: TemplateCategory[] = tenant.categories.map((c) => ({
    name: c.name,
    isVeg: c.isVeg,
    items: c.menuItems.map((it) => ({
      name: it.name,
      description: it.description ?? undefined,
      variants: it.variants.map((v) => ({ label: v.label, pricePaise: v.pricePaise })),
    })),
  }));
  const settings: TemplateSettings = { gstPercent: Number(tenant.gstPercent), splitKitchen: tenant.splitKitchen, prepMinutes: 12 };

  return createTemplate({ name, description, theme: tenant.theme as Record<string, string>, categories, settings });
}
