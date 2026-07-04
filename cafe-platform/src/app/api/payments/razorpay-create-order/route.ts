import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCustomerOrder, type OrderInput } from "@/lib/orders";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { CUSTOMER_COOKIE } from "@/lib/customer-session";

/**
 * Online-mode order: creates the DB order as payment_pending plus a
 * Razorpay order, and returns what the checkout script needs. The order
 * only becomes paid via the webhook — never from the browser callback.
 */
export async function POST(request: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Online payment isn't available right now. Please pay cash at the table." },
      { status: 503 },
    );
  }

  let body: OrderInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await createCustomerOrder(body, "online");
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, soldOutItemIds: result.soldOutItemIds },
      { status: result.status },
    );
  }

  // Resubmit of an existing order reuses its Razorpay order when present.
  let razorpayOrderId: string | null = null;
  if (result.duplicate) {
    const existing = await prisma.order.findUnique({
      where: { id: result.order.id },
      select: { razorpayOrderId: true },
    });
    razorpayOrderId = existing?.razorpayOrderId ?? null;
  }
  if (!razorpayOrderId) {
    const rzpOrder = await createRazorpayOrder({
      amountPaise: result.order.totalAmountPaise,
      receipt: `order_${result.order.id}`.slice(0, 40),
      notes: { app_order_id: result.order.id },
    });
    razorpayOrderId = rzpOrder.id;
    await prisma.order.update({
      where: { id: result.order.id },
      data: { razorpayOrderId },
    });
  }

  const res = NextResponse.json({
    ok: true,
    keyId: process.env.RAZORPAY_KEY_ID,
    razorpayOrderId,
    amountPaise: result.order.totalAmountPaise,
    currency: "INR",
    confirmationToken: result.order.confirmationToken,
  });
  res.cookies.set(CUSTOMER_COOKIE, result.order.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/order",
    maxAge: 24 * 60 * 60,
  });
  return res;
}
