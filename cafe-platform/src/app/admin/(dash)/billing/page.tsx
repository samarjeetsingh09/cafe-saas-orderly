import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPlatformUser } from "@/lib/session";
import { canHq } from "@/lib/hq-permissions";
import { listSubscriptions, listRecentInvoices, totalsFor, planBreakdown } from "@/lib/hq-billing";
import { SubscriptionEditor } from "@/components/admin/SubscriptionEditor";
import { PageHeader, Card, StatStrip, Stat, Badge, TableWrap, Empty, rupees, compactRupees, shortDate, type Tone } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const SUB_TONE: Record<string, Tone> = {
  active: "ok",
  trialing: "info",
  past_due: "danger",
  cancelled: "neutral",
};

const INVOICE_TONE: Record<string, Tone> = { paid: "ok", due: "warn", failed: "danger" };

/** Renewal urgency drives the row rail — this screen is a watchlist first. */
function renewalRail(daysLeft: number, billable: boolean): string | undefined {
  if (!billable) return undefined;
  if (daysLeft < 0) return "danger";
  if (daysLeft <= 14) return "warn";
  return "ok";
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [allRows, plans, invoices, user] = await Promise.all([
    listSubscriptions(),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, pricePaise: true } }),
    listRecentInvoices(40),
    getPlatformUser(),
  ]);

  // Totals always describe the whole book, never the filtered view — a
  // filtered MRR figure is the fastest way to make an ops console lie.
  const totals = totalsFor(allRows);
  const breakdown = planBreakdown(allRows);
  const canEdit = canHq(user!.role, "changeSubscription");

  const statusFilter = sp.status ?? "";
  const planFilter = sp.planId ?? "";
  const expiringOnly = sp.expiring === "1";
  const rows = allRows.filter(
    (r) => (!statusFilter || r.status === statusFilter) && (!planFilter || r.planId === planFilter) && (!expiringOnly || (r.billable && r.daysLeft <= 14))
  );

  const chip = (label: string, params: Record<string, string | undefined>, active: boolean) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const href = q.toString() ? `/admin/billing?${q}` : "/admin/billing";
    return (
      <Link key={label} href={href} className="hq-btn" data-size="sm" data-variant={active ? "primary" : undefined}>
        {label}
      </Link>
    );
  };

  const maxPlanMrr = Math.max(1, ...breakdown.map((b) => b.mrrPaise));

  return (
    <>
      <PageHeader title="Billing" subtitle="Every subscription on the platform, soonest renewal first">
        {!canEdit && <Badge tone="neutral">Read-only — super admin can edit</Badge>}
      </PageHeader>

      <StatStrip>
        <Stat label="MRR" value={compactRupees(totals.mrrPaise)} delta={`${totals.billableCount} billable`} />
        <Stat label="ARR run rate" value={compactRupees(totals.arrPaise)} />
        <Stat label="Avg / cafe" value={compactRupees(totals.averageRevenuePaise)} />
        <Stat label="On trial" value={totals.trialCount} tone="neutral" />
        <Stat label="Past due" value={totals.pastDueCount} tone={totals.pastDueCount > 0 ? "danger" : "neutral"} />
        <Stat label="Expiring ≤14d" value={totals.expiring14dCount} tone={totals.expiring14dCount > 0 ? "warn" : "neutral"} />
        <Stat label="Cancelling" value={totals.cancellingCount} tone={totals.cancellingCount > 0 ? "warn" : "neutral"} />
        <Stat label="Unpaid invoices" value={compactRupees(totals.outstandingPaise)} tone={totals.outstandingPaise > 0 ? "warn" : "neutral"} />
      </StatStrip>

      <div className="hq-toolbar">
        {chip("All", {}, !statusFilter && !expiringOnly && !planFilter)}
        {chip("Expiring ≤14d", { expiring: "1" }, expiringOnly)}
        {chip("Past due", { status: "past_due" }, statusFilter === "past_due")}
        {chip("Trialing", { status: "trialing" }, statusFilter === "trialing")}
        {chip("Cancelled", { status: "cancelled" }, statusFilter === "cancelled")}
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: 12, color: "var(--hq-text-3)" }}>
          {rows.length} of {allRows.length} shown
        </span>
      </div>

      <Card flush>
        {rows.length === 0 ? (
          <Empty title="No subscriptions match" action={<Link href="/admin/billing" className="hq-btn">Clear filters</Link>}>
            Nothing on the book under this filter.
          </Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Cafe</th>
                <th>Plan</th>
                <th className="r">Price / mo</th>
                <th>Status</th>
                <th>Period ends</th>
                <th className="r">Days left</th>
                <th className="r">Unpaid</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tenantId} data-rail={renewalRail(r.daysLeft, r.billable)}>
                  <td>
                    <Link href={`/admin/cafes/${r.tenantId}`} className="name">
                      {r.tenantName}
                    </Link>
                    <span className="sub mono">{r.tenantSlug}</span>
                  </td>
                  <td>
                    {r.planName}
                    {r.cancelAtEnd && <span className="sub">cancels at period end</span>}
                  </td>
                  <td className="r num">
                    {rupees(r.pricePaise)}
                    {r.overridden && (
                      <span className="sub" title={`List price ${rupees(r.listPricePaise)}`}>
                        overridden
                      </span>
                    )}
                  </td>
                  <td>
                    <Badge tone={SUB_TONE[r.status] ?? "neutral"} dot>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="mono" style={{ color: "var(--hq-text-2)" }}>
                    {shortDate(r.currentEnd)}
                  </td>
                  <td className="r num" style={{ color: r.daysLeft < 0 ? "var(--hq-danger)" : r.daysLeft <= 14 ? "var(--hq-warn)" : undefined }}>
                    {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d over` : `${r.daysLeft}d`}
                  </td>
                  <td className="r num" style={{ color: r.dueInvoicePaise > 0 ? "var(--hq-warn)" : "var(--hq-text-3)" }}>
                    {r.dueInvoicePaise > 0 ? rupees(r.dueInvoicePaise) : "—"}
                  </td>
                  {canEdit && (
                    <td>
                      <SubscriptionEditor
                        plans={plans}
                        sub={{
                          tenantId: r.tenantId,
                          tenantName: r.tenantName,
                          planId: r.planId,
                          planName: r.planName,
                          listPricePaise: r.listPricePaise,
                          pricePaise: r.pricePaise,
                          overridden: r.overridden,
                          status: r.status,
                          currentEnd: r.currentEnd.toISOString(),
                          cancelAtEnd: r.cancelAtEnd,
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div className="hq-grid2" style={{ marginTop: 14 }}>
        <Card title="MRR by plan" sub="Billable subscriptions only">
          {breakdown.length === 0 ? (
            <Empty title="No billable subscriptions">Nothing is being charged yet.</Empty>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {breakdown.map((b) => (
                <div key={b.planId}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span>
                      {b.planName} <span style={{ color: "var(--hq-text-3)" }}>· {b.count}</span>
                    </span>
                    <b className="mono">{rupees(b.mrrPaise)}</b>
                  </div>
                  <div style={{ height: 6, background: "var(--hq-line-soft)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(b.mrrPaise / maxPlanMrr) * 100}%`, height: "100%", background: "var(--hq-amber)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent invoices" sub="Newest 40, all cafes" flush>
          {invoices.length === 0 ? (
            <Empty title="No invoices yet">Invoices appear here once a billing cycle closes.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Cafe</th>
                  <th className="r">Amount</th>
                  <th>Status</th>
                  <th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} data-rail={i.status === "paid" ? "ok" : i.status === "failed" ? "danger" : "warn"}>
                    <td className="mono">
                      {i.pdfUrl ? (
                        <a href={i.pdfUrl} className="name" target="_blank" rel="noreferrer">
                          {i.number}
                        </a>
                      ) : (
                        i.number
                      )}
                    </td>
                    <td>
                      <Link href={`/admin/cafes/${i.tenantId}`} className="name">
                        {i.tenantName}
                      </Link>
                    </td>
                    <td className="r num">{rupees(i.amountPaise)}</td>
                    <td>
                      <Badge tone={INVOICE_TONE[i.status] ?? "neutral"}>{i.status}</Badge>
                    </td>
                    <td className="mono" style={{ color: "var(--hq-text-3)" }}>
                      {shortDate(i.issuedOn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
