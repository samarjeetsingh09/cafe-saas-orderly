import { prisma } from "@/lib/db";
import { getOwnerCafe } from "@/lib/session";

export const dynamic = "force-dynamic";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const STATUS_BADGE = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-800" },
  expiring_soon: { label: "Expiring soon", cls: "bg-amber-100 text-amber-800" },
  expired: { label: "Expired", cls: "bg-red-100 text-red-700" },
  disabled: { label: "Disabled", cls: "bg-slate-200 text-slate-600" },
} as const;

const PAYMENT_TYPE_LABEL = {
  setup_advance: "Setup fee — advance",
  setup_final: "Setup fee — final",
  subscription_renewal: "Subscription renewal",
} as const;

/** Billing & Subscription (M6, FR-29): status, expiry, payment history. */
export default async function OwnerBillingPage() {
  const cafe = (await getOwnerCafe())!;
  const payments = await prisma.subscriptionPayment.findMany({
    where: { cafeId: cafe.id },
    orderBy: { paymentDate: "desc" },
  });
  const badge = STATUS_BADGE[cafe.subscriptionStatus];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
      <p className="mt-1 text-sm text-slate-500">Your subscription and payment history.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Subscription</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              ₹{inr.format(Number(cafe.subscriptionAmount))}
              <span className="text-sm font-normal text-slate-500"> / month</span>
            </p>
          </div>
          <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ${badge.cls}`}>{badge.label}</span>
        </div>
        {cafe.subscriptionEndDate && (
          <p className="mt-3 text-sm text-slate-600">
            {cafe.subscriptionStatus === "expired"
              ? `Ended on ${dateFmt.format(cafe.subscriptionEndDate)}. Contact support to renew.`
              : `Paid till ${dateFmt.format(cafe.subscriptionEndDate)}.`}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">Renewals are handled by our team — call or message support.</p>
      </div>

      <h2 className="mt-8 text-sm font-semibold tracking-wider text-slate-500 uppercase">Payment history</h2>
      {payments.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No payments recorded yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{PAYMENT_TYPE_LABEL[p.paymentType]}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {dateFmt.format(p.paymentDate)}
                  {p.periodStart && p.periodEnd && (
                    <> · covers {dateFmt.format(p.periodStart)} – {dateFmt.format(p.periodEnd)}</>
                  )}
                </p>
              </div>
              <p className="text-base font-semibold text-slate-900 tabular-nums">₹{inr.format(Number(p.amount))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
