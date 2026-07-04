import { cookies } from "next/headers";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { CUSTOMER_COOKIE } from "@/lib/customer-session";

/**
 * Order confirmation — read-only receipt (Security doc 3.2: zero edit or
 * cancel actions). URL token AND session cookie must both match; a second
 * browser opening this URL gets the denied state. Refresh-safe: everything
 * is re-read from the DB per request.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your order" };

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const priceLabel = (n: number | string) => `₹${inr.format(Number(n))}`;

function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${
        isVeg ? "border-success" : "border-error"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isVeg ? "bg-success" : "bg-error"}`} />
    </span>
  );
}

function Denied() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <h1 className="text-xl font-bold text-primary">We couldn&apos;t show this order</h1>
      <p className="text-muted">
        This link only works on the phone that placed the order. If that&apos;s you, ask the staff
        for help.
      </p>
    </main>
  );
}

type Props = { params: Promise<{ confirmationToken: string }> };

export default async function Page({ params }: Props) {
  const { confirmationToken } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CUSTOMER_COOKIE)?.value;

  const order = await prisma.order.findUnique({
    where: { confirmationToken },
    select: {
      orderNumber: true,
      customerName: true,
      customerSessionToken: true,
      paymentMode: true,
      paymentStatus: true,
      totalAmount: true,
      createdAt: true,
      cafe: { select: { name: true } },
      table: { select: { tableNumber: true } },
      orderItems: {
        select: {
          id: true,
          itemNameSnapshot: true,
          itemPriceSnapshot: true,
          quantity: true,
          subtotal: true,
          menuItem: { select: { isVeg: true } },
        },
      },
    },
  });

  // Token alone is not sufficient — the session cookie must match too.
  if (!order || !sessionToken || order.customerSessionToken !== sessionToken) {
    return <Denied />;
  }

  const cashPending = order.paymentStatus === "cash_pending";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center bg-background px-4 py-8">
      {/* Success mark */}
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8 text-success" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
      <h1 className="text-xl font-bold text-primary">Order placed</h1>
      <p className="mb-6 text-sm text-muted">
        {order.cafe.name} · Table {order.table.tableNumber}
      </p>

      {/* Receipt card — perforated top edge */}
      <section
        aria-label="Order receipt"
        className="w-full rounded-2xl border border-border bg-surface shadow-sm"
      >
        <div className="border-b-2 border-dashed border-border px-6 py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Your order number
          </p>
          <p className="text-6xl font-bold tabular-nums text-primary">#{order.orderNumber}</p>
          <p className="mt-2 text-sm text-muted">Show this to staff if asked</p>
        </div>

        <ul className="flex flex-col divide-y divide-border px-6">
          {order.orderItems.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-3">
              <VegMark isVeg={line.menuItem?.isVeg ?? true} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {line.itemNameSnapshot}
              </span>
              <span className="text-sm text-muted tabular-nums">×{line.quantity}</span>
              <span className="w-16 text-right font-semibold tabular-nums">
                {priceLabel(line.subtotal.toString())}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-6 py-4 text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{priceLabel(order.totalAmount.toString())}</span>
        </div>
      </section>

      {/* Payment status */}
      <p
        className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold ${
          cashPending ? "bg-warning/15 text-[#92400e]" : "bg-success/15 text-success"
        }`}
      >
        {cashPending
          ? `Pay ${priceLabel(order.totalAmount.toString())} in cash at your table`
          : "Paid"}
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        {order.customerName}, your order has reached the kitchen.
      </p>
    </main>
  );
}
