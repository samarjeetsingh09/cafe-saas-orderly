import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  priceRupees: z.number().min(0).max(1_000_000).optional(),
  maxTables: z.number().int().min(1).max(500).optional(),
  features: z.array(z.string().trim().max(60)).max(12).optional(),
  sortOrder: z.number().int().min(0).max(99).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("managePlatformUsers");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, priceRupees, maxTables, features, sortOrder } = parsed.data;
  const changes = [
    name && name !== plan.name ? `name → ${name}` : null,
    priceRupees !== undefined && Math.round(priceRupees * 100) !== plan.pricePaise ? `price ₹${plan.pricePaise / 100} → ₹${priceRupees}` : null,
    maxTables !== undefined && maxTables !== plan.maxTables ? `tables ${plan.maxTables} → ${maxTables}` : null,
    features ? "features updated" : null,
    sortOrder !== undefined && sortOrder !== plan.sortOrder ? `order → ${sortOrder}` : null,
  ].filter(Boolean) as string[];
  if (changes.length === 0) return NextResponse.json({ ok: true, unchanged: true });

  await prisma.$transaction(async (tx) => {
    await tx.plan.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(priceRupees !== undefined ? { pricePaise: Math.round(priceRupees * 100) } : {}),
        ...(maxTables !== undefined ? { maxTables } : {}),
        ...(features ? { features } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    await logActivity(tx, guard.user, {
      action: "plan.updated",
      target: `plan:${id}`,
      // A price change here re-prices every cafe on the plan that has no
      // negotiated override — worth spelling out in the log, not just "updated".
      summary: `${guard.user.fullName} updated the ${plan.name} plan — ${changes.join(", ")}`,
      meta: { changes },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("managePlatformUsers");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const plan = await prisma.plan.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { subscriptions: true } } } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Refused rather than cascaded: deleting a plan out from under live
  // subscriptions would orphan the price every one of them is billed at.
  if (plan._count.subscriptions > 0) {
    return NextResponse.json({ error: `${plan._count.subscriptions} cafe(s) are on this plan — move them first` }, { status: 409 });
  }

  await prisma.plan.delete({ where: { id } });
  await logActivity(prisma, guard.user, {
    action: "plan.deleted",
    target: `plan:${id}`,
    summary: `${guard.user.fullName} deleted the ${plan.name} plan`,
  });
  return NextResponse.json({ ok: true });
}
