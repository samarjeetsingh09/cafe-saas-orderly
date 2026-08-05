import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { boardOrderInclude, toBoardOrderDTO } from "@/lib/owner-board";

/**
 * Re-read one order for the customer's own tracker.
 *
 * Why this exists: the tracker used to live purely in React state, so a
 * customer who hit Back, reloaded, or let the tab get evicted lost every way
 * to see their order again — they had to ask at the counter. The client now
 * remembers the order id in localStorage (`lib/saved-order.ts`) and calls
 * this to rehydrate; SSE (`/api/stream?orderId=&qrToken=`) takes over for
 * live stage changes once the tracker is open.
 *
 * Deliberately public, same trust model as `[id]/mock-pay`: knowing the
 * order's unguessable uuid is the credential. This tightens it one notch by
 * also requiring `?qrToken=` and matching the order to *that table* — a
 * stale id from another cafe (or another table) can't be used to read a
 * stranger's name, phone and notes off this endpoint.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qrToken = new URL(request.url).searchParams.get("qrToken");
  if (!qrToken) {
    return NextResponse.json({ error: "qrToken required" }, { status: 400 });
  }

  const table = await prisma.cafeTable.findUnique({ where: { qrToken }, select: { id: true } });
  if (!table) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = await prisma.order.findFirst({
    where: { id, tableId: table.id },
    include: boardOrderInclude,
  });
  // Same 404 for "no such order" and "not your table" — don't confirm an id
  // exists to someone holding the wrong token.
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order: toBoardOrderDTO(order) });
}
