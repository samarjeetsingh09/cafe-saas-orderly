import Link from "next/link";
import { getOwnerCafe } from "@/lib/session";
import { getTodayStats } from "@/lib/owner-stats";

export const dynamic = "force-dynamic";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * Owner Home (DESIGN_SYSTEM 2): exactly 3 large stat cards, no charts.
 * Big numbers readable at arm's length in a noisy cafe.
 */
export default async function OwnerHomePage() {
  const cafe = (await getOwnerCafe())!; // layout guard guarantees a cafe
  const stats = await getTodayStats(cafe.id);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Today</h1>
      <p className="mt-1 text-sm text-slate-500">
        {new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "Asia/Kolkata",
        }).format(new Date())}
        {" · "}
        {stats.orderCount} {stats.orderCount === 1 ? "order" : "orders"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Today Total" amount={stats.todayTotal} tone="primary" />
        <StatCard label="Online Paid" amount={stats.onlinePaid} tone="success" />
        <StatCard
          label="Cash Pending"
          amount={stats.cashPending}
          tone="warning"
          footnote={`₹${inr.format(stats.cashCollected)} cash collected`}
        />
      </div>

      <div className="mt-8">
        <Link
          href="/owner/orders"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
        >
          See today&apos;s orders
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

const TONES = {
  primary: "border-slate-200 bg-white",
  success: "border-slate-200 bg-white",
  warning: "border-amber-300 bg-amber-50",
} as const;

const AMOUNT_TONES = {
  primary: "text-slate-900",
  success: "text-success",
  warning: "text-amber-700",
} as const;

function StatCard({
  label,
  amount,
  tone,
  footnote,
}: {
  label: string;
  amount: number;
  tone: keyof typeof TONES;
  footnote?: string;
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${TONES[tone]}`}>
      <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${AMOUNT_TONES[tone]}`}>
        ₹{inr.format(amount)}
      </p>
      {footnote && <p className="mt-2 text-xs text-slate-500">{footnote}</p>}
    </div>
  );
}
