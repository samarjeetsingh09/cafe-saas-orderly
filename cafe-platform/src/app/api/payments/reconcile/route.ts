import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/session";
import { fetchRazorpayPayments, razorpayConfigured } from "@/lib/razorpay";

/**
 * Admin reconcile (Security doc 5.7): when a webhook may have been missed,
 * ask Razorpay for the order's real payment status and repair ours.
 * Admin-only; surfaced as a button in the founder portal (M10).
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Admin session required" }, { status: 401 });
    }
    throw e;
  }
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay keys are not configured" }, { status: 503 });
  }

  let body: { orderId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, razorpayOrderId: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.razorpayOrderId) {
    return NextResponse.json({ error: "Not an online order" }, { status: 400 });
  }

  const payments = await fetchRazorpayPayments(order.razorpayOrderId);
  const captured = payments.items.find((p) => p.status === "captured");

  if (captured && order.paymentStatus === "payment_pending") {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "paid", razorpayPaymentId: captured.id },
    });
    return NextResponse.json({ ok: true, repaired: true, paymentStatus: "paid" });
  }

  return NextResponse.json({
    ok: true,
    repaired: false,
    paymentStatus: captured ? "paid" : order.paymentStatus,
    razorpayStatus: captured ? "captured" : (payments.items[0]?.status ?? "no_payments"),
  });
}
