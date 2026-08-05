import { prisma } from "@/lib/db";
import type { SubStatus, InvoiceStatus } from "@prisma/client";

/** Plan tab (Phase H #6) — real `Plan`/`Subscription`/`Invoice` rows. */
export type PlanDTO = { id: string; name: string; pricePaise: number; maxTables: number; features: string[]; sortOrder: number };
export type SubscriptionDTO = { planId: string; status: SubStatus; currentStart: string; currentEnd: string; cancelAtEnd: boolean };
export type InvoiceDTO = { id: string; number: string; amountPaise: number; status: InvoiceStatus; issuedOn: string };

export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export async function getPlanData(tenantId: string): Promise<{ plans: PlanDTO[]; subscription: SubscriptionDTO | null; invoices: InvoiceDTO[] }> {
  const [plans, subscription, invoices] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.subscription.findUnique({ where: { tenantId } }),
    prisma.invoice.findMany({ where: { tenantId }, orderBy: { issuedOn: "desc" } }),
  ]);

  return {
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      pricePaise: p.pricePaise,
      maxTables: p.maxTables,
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
      sortOrder: p.sortOrder,
    })),
    subscription: subscription
      ? {
          planId: subscription.planId,
          status: subscription.status,
          currentStart: subscription.currentStart.toISOString(),
          currentEnd: subscription.currentEnd.toISOString(),
          cancelAtEnd: subscription.cancelAtEnd,
        }
      : null,
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, amountPaise: i.amountPaise, status: i.status, issuedOn: i.issuedOn.toISOString() })),
  };
}
