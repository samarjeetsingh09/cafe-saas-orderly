import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  planId: z.string().min(1).optional(),
  status: z.enum(["trialing", "active", "past_due", "cancelled"]).optional(),
  currentEnd: z.string().optional(),
  cancelAtEnd: z.boolean().optional(),
  /** Rupees from the form; null clears the override back to list price. */
  priceOverrideRupees: z.number().min(0).max(1_000_000).nullable().optional(),
});

/**
 * Change a cafe's subscription (HQ-PORTAL-SPEC.md §7). `changeSubscription`
 * is super_admin-only in the capability matrix — money moves, so the guard
 * matters more than the hidden button.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const guard = await requireHq("changeSubscription");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { tenantId } = await params;
  const existing = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true, tenant: { select: { name: true, deletedAt: true } } },
  });
  if (!existing || existing.tenant.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { planId, status, currentEnd, cancelAtEnd, priceOverrideRupees } = parsed.data;

  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const changes: string[] = [];
  if (planId && planId !== existing.planId) changes.push(`plan ${existing.planId} → ${planId}`);
  if (status && status !== existing.status) changes.push(`status ${existing.status} → ${status}`);
  if (currentEnd) changes.push(`renews ${new Date(currentEnd).toISOString().slice(0, 10)}`);
  if (cancelAtEnd !== undefined && cancelAtEnd !== existing.cancelAtEnd) changes.push(cancelAtEnd ? "set to cancel at period end" : "cancellation removed");
  if (priceOverrideRupees !== undefined) {
    changes.push(priceOverrideRupees === null ? "price override cleared" : `price overridden to ₹${priceOverrideRupees}`);
  }
  if (changes.length === 0) return NextResponse.json({ ok: true, unchanged: true });

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { tenantId },
      data: {
        ...(planId ? { planId } : {}),
        ...(status ? { status } : {}),
        ...(currentEnd ? { currentEnd: new Date(currentEnd) } : {}),
        ...(cancelAtEnd !== undefined ? { cancelAtEnd } : {}),
        ...(priceOverrideRupees !== undefined
          ? { priceOverridePaise: priceOverrideRupees === null ? null : Math.round(priceOverrideRupees * 100) }
          : {}),
      },
    });
    await logActivity(tx, guard.user, {
      tenantId,
      action: "subscription.changed",
      target: `tenant:${tenantId}`,
      summary: `${guard.user.fullName} changed ${existing.tenant.name}'s subscription — ${changes.join(", ")}`,
      meta: { changes },
    });
  });

  return NextResponse.json({ ok: true });
}
