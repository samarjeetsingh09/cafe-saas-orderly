import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { emit } from "@/lib/bus";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

/**
 * plan/BUILD-SPEC.md §9 `PATCH /api/orders/[id]/settle` — marks a cash order
 * collected. Waiter+ only. Race-safe: the filter inside updateMany means the
 * first request wins and a second concurrent tap sees "already collected",
 * same pattern as the Razorpay webhook's idempotent update.
 */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    }
    throw e;
  }
  if (!can(profile.role, "settleCash")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { id } = await params;
  const updated = await prisma.order.updateMany({
    where: { id, tenantId: profile.tenantId, payMethod: "cash", payStatus: "pending" },
    data: { payStatus: "paid" },
  });
  if (updated.count === 1) {
    emit(profile.tenantId, "order.updated", { id, payStatus: "paid" });
    await auditIfImpersonated(profile, "order.cash_collected", `collected cash for order ${id}`, { orderId: id });
    return NextResponse.json({ ok: true, payStatus: "paid" });
  }

  const order = await prisma.order.findFirst({
    where: { id, tenantId: profile.tenantId },
    select: { payStatus: true, payMethod: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payStatus === "paid") {
    return NextResponse.json({ error: "Already collected" }, { status: 409 });
  }
  return NextResponse.json({ error: "Not a cash order awaiting collection" }, { status: 409 });
}
