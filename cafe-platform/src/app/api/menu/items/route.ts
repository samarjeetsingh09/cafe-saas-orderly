import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

const Body = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  variants: z
    .array(z.object({ label: z.string().trim().min(1).max(40), pricePaise: z.number().int().min(1) }))
    .min(1)
    .max(10),
});

export async function POST(request: Request) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }
  if (!can(profile.role, "editMenu")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const labels = parsed.data.variants.map((v) => v.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return NextResponse.json({ error: "Size labels must be unique" }, { status: 400 });
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, tenantId: profile.tenantId },
    select: { id: true, isVeg: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const count = await prisma.menuItem.count({ where: { tenantId: profile.tenantId, categoryId: category.id } });
  const item = await prisma.menuItem.create({
    data: {
      tenantId: profile.tenantId,
      categoryId: category.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isVeg: category.isVeg,
      sortOrder: count,
      variants: {
        create: parsed.data.variants.map((v, i) => ({
          tenantId: profile.tenantId,
          label: v.label,
          pricePaise: v.pricePaise,
          sortOrder: i,
        })),
      },
    },
    include: { variants: true },
  });
  await auditIfImpersonated(profile, "menu.item_created", `created menu item "${item.name}"`, { itemId: item.id });

  return NextResponse.json({ item }, { status: 201 });
}
