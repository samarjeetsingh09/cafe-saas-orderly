import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/bus";

/**
 * Local substitute for the Razorpay webhook — plan/START-HERE.md's scope
 * table: "Razorpay charge → mock screen; mark the order paid after a 2s
 * delay." Real payment gateway calls are explicitly out of scope for this
 * build (see plan/START-HERE.md SCOPE).
 *
 * Deliberately public (no staff session) — the customer's own browser calls
 * this right after tapping "I've paid" on the mock UPI screen. Authorized by
 * knowing the order's id (an unguessable uuid returned only to whoever
 * placed it), same trust level as a magic link. Race-safe: updateMany's
 * filter means only a `pending` online order flips, so this can't be used
 * to "pay" a cash order or double-pay an already-paid one.
 */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, select: { tenantId: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updated = await prisma.order.updateMany({
    where: { id, payMethod: "online", payStatus: "pending" },
    data: { payStatus: "paid" },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Order isn't awaiting online payment" }, { status: 409 });
  }

  emit(order.tenantId, "order.updated", { id, payStatus: "paid" });
  return NextResponse.json({ ok: true, payStatus: "paid" });
}
