import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { canAdvance, STAMP } from "@/lib/order-machine";
import { emit } from "@/lib/bus";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

/**
 * plan/BUILD-SPEC.md §9 `PATCH /api/orders/[id]/stage`. Stage rules live only
 * in lib/order-machine.ts. A repeat of the same transition (double-tap on a
 * busy pass) is a no-op, not an error — order.stage already equals `to`.
 */
const Body = z.object({
  to: z.enum(["new", "preparing", "ready", "served", "cancelled"]),
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
  if (!can(profile.role, "advanceStage")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const to = parsed.data.to as OrderStage;

  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, tenantId: profile.tenantId } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.stage === to) {
    return NextResponse.json({ order });
  }
  if (!canAdvance(profile.role, order.stage, to)) {
    return NextResponse.json({ error: "Transition not allowed" }, { status: 403 });
  }

  const stampField = STAMP[to];
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id: order.id },
      data: {
        stage: to,
        ...(stampField ? { [stampField]: new Date() } : {}),
      },
    });
    await tx.orderEvent.create({
      data: {
        tenantId: profile.tenantId,
        orderId: order.id,
        fromStage: order.stage,
        toStage: to,
        actorId: profile.id,
        actorKind: "staff",
      },
    });
    return row;
  });

  emit(profile.tenantId, "order.updated", {
    id: updated.id,
    stage: updated.stage,
    readyAt: updated.readyAt ? updated.readyAt.toISOString() : null,
  });
  await auditIfImpersonated(profile, "order.stage_changed", `moved order ${updated.code} to ${to}`, { orderId: updated.id, from: order.stage, to });

  return NextResponse.json({ order: updated });
}
