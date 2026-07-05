import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner, UnauthorizedError } from "@/lib/session";

/**
 * Mark a cash order collected (M6). Race-safe per Security doc 5.3: the
 * status filter inside updateMany means the first request wins and the
 * second sees "already collected" — same pattern as the Razorpay webhook.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  let cafeId: string;
  try {
    cafeId = (await requireOwner()).id;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Owner session required" }, { status: 401 });
    }
    throw e;
  }

  const { orderId } = await params;
  const updated = await prisma.order.updateMany({
    where: { id: orderId, cafeId, paymentMode: "cash", paymentStatus: "cash_pending" },
    data: { paymentStatus: "collected" },
  });
  if (updated.count === 1) return NextResponse.json({ ok: true, paymentStatus: "collected" });

  // Lost the race, wrong cafe, or not a cash-pending order — look up why.
  const order = await prisma.order.findFirst({
    where: { id: orderId, cafeId },
    select: { paymentStatus: true, paymentMode: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "collected") {
    return NextResponse.json({ error: "Already collected" }, { status: 409 });
  }
  return NextResponse.json({ error: "Not a cash order awaiting collection" }, { status: 409 });
}
