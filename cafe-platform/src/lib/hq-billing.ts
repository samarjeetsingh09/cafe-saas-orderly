import { prisma } from "@/lib/db";
import type { SubStatus, InvoiceStatus } from "@prisma/client";

/**
 * Cross-tenant billing (HQ-PORTAL-SPEC.md §7). The per-tenant view lives in
 * `lib/owner-plan.ts` and answers "what am I paying?"; this one answers
 * "what is the platform earning, and what is about to lapse?" — so it is
 * deliberately a separate module rather than a loop over `getPlanData()`,
 * which would be one query pair per cafe.
 *
 * MRR counts **billable** subscriptions only: `active` and `past_due`.
 * Trials contribute ₹0 until they convert — counting them would inflate the
 * number with revenue nobody has agreed to pay, which is exactly the metric
 * an ops console must not lie about. `priceOverridePaise` wins over the
 * plan's list price wherever it is set.
 */

export const BILLABLE: SubStatus[] = ["active", "past_due"];

export type BillingRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: string;
  planId: string;
  planName: string;
  listPricePaise: number;
  pricePaise: number;
  overridden: boolean;
  status: SubStatus;
  currentStart: Date;
  currentEnd: Date;
  daysLeft: number;
  cancelAtEnd: boolean;
  billable: boolean;
  dueInvoicePaise: number;
};

export type BillingTotals = {
  mrrPaise: number;
  arrPaise: number;
  billableCount: number;
  trialCount: number;
  pastDueCount: number;
  cancellingCount: number;
  expiring14dCount: number;
  outstandingPaise: number;
  averageRevenuePaise: number;
};

export type PlanBreakdownRow = { planId: string; planName: string; count: number; mrrPaise: number };

export type InvoiceRow = {
  id: string;
  number: string;
  tenantId: string;
  tenantName: string;
  amountPaise: number;
  status: InvoiceStatus;
  issuedOn: Date;
  pdfUrl: string | null;
};

const dayDiff = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86_400_000);

export async function listSubscriptions(filters: { status?: string; planId?: string; expiringOnly?: boolean } = {}): Promise<BillingRow[]> {
  const subs = await prisma.subscription.findMany({
    where: {
      ...(filters.status ? { status: filters.status as SubStatus } : {}),
      ...(filters.planId ? { planId: filters.planId } : {}),
      tenant: { deletedAt: null },
    },
    include: {
      plan: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          invoices: { where: { status: { not: "paid" } }, select: { amountPaise: true } },
        },
      },
    },
  });

  const rows = subs.map<BillingRow>((s) => {
    const pricePaise = s.priceOverridePaise ?? s.plan.pricePaise;
    return {
      tenantId: s.tenant.id,
      tenantName: s.tenant.name,
      tenantSlug: s.tenant.slug,
      tenantStatus: s.tenant.status,
      planId: s.planId,
      planName: s.plan.name,
      listPricePaise: s.plan.pricePaise,
      pricePaise,
      overridden: s.priceOverridePaise !== null,
      status: s.status,
      currentStart: s.currentStart,
      currentEnd: s.currentEnd,
      daysLeft: dayDiff(s.currentEnd),
      cancelAtEnd: s.cancelAtEnd,
      billable: BILLABLE.includes(s.status),
      dueInvoicePaise: s.tenant.invoices.reduce((sum, i) => sum + i.amountPaise, 0),
    };
  });

  const filtered = filters.expiringOnly ? rows.filter((r) => r.daysLeft <= 14) : rows;
  // Soonest to lapse first — this screen exists to catch renewals before they do.
  return filtered.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function totalsFor(rows: BillingRow[]): BillingTotals {
  const billable = rows.filter((r) => r.billable);
  const mrrPaise = billable.reduce((s, r) => s + r.pricePaise, 0);
  return {
    mrrPaise,
    arrPaise: mrrPaise * 12,
    billableCount: billable.length,
    trialCount: rows.filter((r) => r.status === "trialing").length,
    pastDueCount: rows.filter((r) => r.status === "past_due").length,
    cancellingCount: rows.filter((r) => r.cancelAtEnd && r.status !== "cancelled").length,
    expiring14dCount: rows.filter((r) => r.billable && r.daysLeft <= 14).length,
    outstandingPaise: rows.reduce((s, r) => s + r.dueInvoicePaise, 0),
    averageRevenuePaise: billable.length ? Math.round(mrrPaise / billable.length) : 0,
  };
}

export function planBreakdown(rows: BillingRow[]): PlanBreakdownRow[] {
  const map = new Map<string, PlanBreakdownRow>();
  for (const r of rows) {
    if (!r.billable) continue;
    const entry = map.get(r.planId) ?? { planId: r.planId, planName: r.planName, count: 0, mrrPaise: 0 };
    entry.count += 1;
    entry.mrrPaise += r.pricePaise;
    map.set(r.planId, entry);
  }
  return [...map.values()].sort((a, b) => b.mrrPaise - a.mrrPaise);
}

export async function listRecentInvoices(limit = 40): Promise<InvoiceRow[]> {
  const invoices = await prisma.invoice.findMany({
    where: { tenant: { deletedAt: null } },
    orderBy: [{ issuedOn: "desc" }, { number: "desc" }],
    take: limit,
    include: { tenant: { select: { id: true, name: true } } },
  });
  return invoices.map((i) => ({
    id: i.id,
    number: i.number,
    tenantId: i.tenant.id,
    tenantName: i.tenant.name,
    amountPaise: i.amountPaise,
    status: i.status,
    issuedOn: i.issuedOn,
    pdfUrl: i.pdfUrl,
  }));
}
