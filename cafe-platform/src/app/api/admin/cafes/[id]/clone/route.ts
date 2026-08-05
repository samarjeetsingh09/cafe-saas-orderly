import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";
import { isValidCafeSlug } from "@/lib/slugs";

const Body = z.object({ name: z.string().trim().min(1).max(80), slug: z.string().trim().toLowerCase() });

/**
 * Clone (HQ-PORTAL-SPEC.md §7): theme, settings, table count/layout and the
 * full menu copy across. Orders, customers, staff accounts, tickets,
 * invoices and QR tokens never do — the clone gets fresh QR tokens and zero
 * staff logins (adding staff is the provisioning wizard's job, not a second
 * user-management screen — Rule 3).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("provisionCafe");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { name, slug } = parsed.data;

  if (!isValidCafeSlug(slug)) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  const slugTaken = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (slugTaken) return NextResponse.json({ error: "That slug is already taken" }, { status: 409 });

  const { id: sourceId } = await params;
  const source = await prisma.tenant.findUnique({
    where: { id: sourceId },
    include: {
      cafeTables: { where: { active: true }, orderBy: { label: "asc" } },
      categories: { orderBy: { sortOrder: "asc" }, include: { menuItems: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } } } },
      paymentConfig: true,
      subscription: true,
    },
  });
  if (!source || source.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newTenant = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          theme: source.theme as object,
          currency: source.currency,
          gstPercent: source.gstPercent,
          timezone: source.timezone,
          splitKitchen: source.splitKitchen,
          status: "trial",
          templateId: source.templateId,
        },
      });

      for (const t of source.cafeTables) {
        await tx.cafeTable.create({ data: { tenantId: tenant.id, label: t.label, qrToken: randomBytes(16).toString("hex"), active: true } });
      }

      for (let ci = 0; ci < source.categories.length; ci++) {
        const c = source.categories[ci];
        const category = await tx.category.create({ data: { tenantId: tenant.id, name: c.name, isVeg: c.isVeg, sortOrder: ci } });
        for (let ii = 0; ii < c.menuItems.length; ii++) {
          const it = c.menuItems[ii];
          const item = await tx.menuItem.create({
            data: { tenantId: tenant.id, categoryId: category.id, name: it.name, description: it.description, isVeg: it.isVeg, prepMinutes: it.prepMinutes, sortOrder: ii },
          });
          for (let vi = 0; vi < it.variants.length; vi++) {
            const v = it.variants[vi];
            await tx.itemVariant.create({ data: { tenantId: tenant.id, itemId: item.id, label: v.label, pricePaise: v.pricePaise, sortOrder: vi } });
          }
        }
      }

      if (source.paymentConfig) {
        await tx.paymentConfig.create({
          data: {
            tenantId: tenant.id,
            acceptCash: source.paymentConfig.acceptCash,
            acceptCounterUpi: source.paymentConfig.acceptCounterUpi,
            acceptOnline: source.paymentConfig.acceptOnline,
            gateway: source.paymentConfig.gateway,
            enabled: false, // shape only — never copy live keys, see docstring
          },
        });
      }

      if (source.subscription) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: source.subscription.planId,
            status: "trialing",
            currentStart: new Date(),
            currentEnd: new Date(Date.now() + 14 * 86_400_000),
          },
        });
      }

      await tx.tenantHealth.create({ data: { tenantId: tenant.id } });

      await logActivity(tx, guard.user, {
        tenantId: tenant.id,
        action: "cafe.cloned",
        target: `tenant:${tenant.id}`,
        summary: `${guard.user.fullName} cloned ${source.name} into ${tenant.name}`,
        meta: { sourceTenantId: source.id },
      });

      return tenant;
    },
    { timeout: 20_000 }
  );

  return NextResponse.json({ tenantId: newTenant.id, slug: newTenant.slug }, { status: 201 });
}
