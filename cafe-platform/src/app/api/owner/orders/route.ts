import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/session";
import { getTodayOrders } from "@/lib/owner-orders";

/** Owner Orders feed (M6) — polled by the dashboard until M7 realtime. */
export async function GET() {
  try {
    const cafe = await requireOwner();
    const orders = await getTodayOrders(cafe.id);
    return NextResponse.json({ orders });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Owner session required" }, { status: 401 });
    }
    throw e;
  }
}
