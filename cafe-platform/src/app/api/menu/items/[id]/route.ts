import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { emit } from "@/lib/bus";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

/**
 * plan/BUILD-SPEC.md §9 `PATCH /api/menu/items/[id]`. Two capabilities share
 * this one route, same as the spec's own example bodies:
 *  - `{ available }` — the 86 switch, kitchen or manager (Phase G).
 *  - `{ name, description, variants }` — manager+ only (Phase H). `variants`
 *    is a full replace: entries with an `id` are updated, entries without
 *    one are created, and any existing variant not present in the array is
 *    deleted — mirrors the prototype's add/remove-a-size UI in one call.
 */
const Body = z.object({
  available: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string().trim().min(1).max(40),
        pricePaise: z.number().int().min(1),
      })
    )
    .min(1)
    .max(10)
    .optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    }
    throw e;
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { available, name, description, variants } = parsed.data;

  const editsMenu = name !== undefined || description !== undefined || variants !== undefined;
  if (editsMenu && !can(profile.role, "editMenu")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  if (available !== undefined && !can(profile.role, "toggleAvailability")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  if (variants) {
    const labels = variants.map((v) => v.label.toLowerCase());
    if (new Set(labels).size !== labels.length) {
      return NextResponse.json({ error: "Size labels must be unique" }, { status: 400 });
    }
  }

  const { id } = await params;
  const item = await prisma.menuItem.findFirst({ where: { id, tenantId: profile.tenantId } });
  if (!item) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const data: Prisma.MenuItemUpdateInput = {};
      if (available !== undefined) data.available = available;
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description || null;
      if (Object.keys(data).length) {
        await tx.menuItem.update({ where: { id }, data });
      }

      if (variants) {
        const existing = await tx.itemVariant.findMany({ where: { itemId: id }, select: { id: true } });
        const keepIds = new Set(variants.filter((v) => v.id).map((v) => v.id));
        const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
        if (toDelete.length) {
          await tx.itemVariant.deleteMany({ where: { id: { in: toDelete } } });
        }
        for (const [i, v] of variants.entries()) {
          if (v.id) {
            await tx.itemVariant.update({ where: { id: v.id }, data: { label: v.label, pricePaise: v.pricePaise, sortOrder: i } });
          } else {
            await tx.itemVariant.create({
              data: { tenantId: profile.tenantId, itemId: id, label: v.label, pricePaise: v.pricePaise, sortOrder: i },
            });
          }
        }
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Duplicate size label" }, { status: 409 });
    }
    throw e;
  }

  if (available !== undefined) {
    emit(profile.tenantId, "menu.updated", { itemId: id, available });
  }
  await auditIfImpersonated(profile, "menu.item_updated", `updated menu item "${item.name}"`, { itemId: id, name, description, variants, available });

  const updated = await prisma.menuItem.findUniqueOrThrow({
    where: { id },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({
    item: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isVeg: updated.isVeg,
      available: updated.available,
      variants: updated.variants.map((v) => ({ id: v.id, label: v.label, pricePaise: v.pricePaise })),
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    }
    throw e;
  }
  if (!can(profile.role, "editMenu")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.menuItem.findFirst({ where: { id, tenantId: profile.tenantId }, select: { name: true } });
  const deleted = await prisma.menuItem.deleteMany({ where: { id, tenantId: profile.tenantId } });
  if (deleted.count !== 1) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }
  await auditIfImpersonated(profile, "menu.item_deleted", `deleted menu item "${target?.name}"`, { itemId: id });
  return NextResponse.json({ ok: true });
}
