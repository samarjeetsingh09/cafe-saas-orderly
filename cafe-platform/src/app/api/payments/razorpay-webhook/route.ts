import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook — THE single source of truth for online payment status
 * (Security doc 5.1/5.7). paid is set here and only here, idempotently.
 * Always 200 after safe handling so Razorpay stops retrying; 400 only for
 * bad signatures.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true, note: "unparseable body ignored" });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;
    if (razorpayOrderId) {
      // Idempotent: updateMany filtered on not-yet-paid; a retry or a
      // duplicate delivery changes zero rows.
      await prisma.order.updateMany({
        where: { razorpayOrderId, paymentStatus: "payment_pending" },
        data: { paymentStatus: "paid", razorpayPaymentId: payment?.id ?? null },
      });
    }
  }
  // payment.failed and unknown events: acknowledged, nothing to change —
  // the order stays payment_pending and is never printed/fulfilled.

  return NextResponse.json({ ok: true });
}
