import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOwnerCafe } from "@/lib/session";

export const dynamic = "force-dynamic";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
// SQL ::date arrives as a JS Date at UTC midnight — format in UTC to keep the label on that date.
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

type DayRow = { day: string; orders: number; online: number; cash: number; total: number };

/**
 * Sales Reports (M6, FR-30): day-over-day for the last 14 IST days.
 * Only money-confirmed orders count (paid / cash_pending / collected) —
 * same rule as the Home cards, so the numbers always agree.
 */
async function getDailySales(cafeId: string): Promise<DayRow[]> {
  const rows = await prisma.$queryRaw<
    { day: Date; orders: bigint; online: Prisma.Decimal | null; cash: Prisma.Decimal | null }[]
  >`
    SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
           COUNT(*) AS orders,
           SUM(total_amount) FILTER (WHERE payment_status = 'paid') AS online,
           SUM(total_amount) FILTER (WHERE payment_status IN ('cash_pending', 'collected')) AS cash
    FROM orders
    WHERE cafe_id = ${cafeId}::uuid
      AND payment_status IN ('paid', 'cash_pending', 'collected')
      AND (created_at AT TIME ZONE 'Asia/Kolkata') >= (now() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '13 days'
    GROUP BY 1
    ORDER BY 1 DESC
  `;
  return rows.map((r) => {
    const online = Number(r.online ?? 0);
    const cash = Number(r.cash ?? 0);
    return {
      day: dayFmt.format(r.day),
      orders: Number(r.orders),
      online,
      cash,
      total: online + cash,
    };
  });
}

export default async function OwnerReportsPage() {
  const cafe = (await getOwnerCafe())!;
  const days = await getDailySales(cafe.id);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">Sales by day, last two weeks.</p>

      {days.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No sales in the last two weeks.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-105 text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <th scope="col" className="px-5 py-3">Day</th>
                <th scope="col" className="px-5 py-3 text-right">Orders</th>
                <th scope="col" className="px-5 py-3 text-right">Online</th>
                <th scope="col" className="px-5 py-3 text-right">Cash</th>
                <th scope="col" className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {days.map((d) => (
                <tr key={d.day}>
                  <td className="px-5 py-3 font-medium text-slate-900">{d.day}</td>
                  <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{d.orders}</td>
                  <td className="px-5 py-3 text-right text-slate-600 tabular-nums">₹{inr.format(d.online)}</td>
                  <td className="px-5 py-3 text-right text-slate-600 tabular-nums">₹{inr.format(d.cash)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                    ₹{inr.format(d.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
