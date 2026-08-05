import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";

/** HQ dashboard (HQ-PORTAL-SPEC.md §4) — cards, recent activity, needs-attention. */
export type DashboardCards = {
  totalCafes: number;
  active: number;
  trial: number;
  paused: number;
  expiringSoon: number;
  ordersToday: number;
  revenueTodayPaise: number;
  mrrPaise: number;
  openTickets: number;
  zeroOrderCafes: number;
};

export type ActivityFeedRow = {
  id: string;
  actorEmail: string;
  tenantName: string | null;
  action: string;
  summary: string;
  at: string;
};

export type NeedsAttentionRow = {
  kind: "expiring_sub" | "old_ticket" | "quiet_cafe";
  tenantId: string;
  tenantName: string;
  detail: string;
};

export async function getDashboardCards(): Promise<DashboardCards> {
  const dayStart = istDayStart();
  const in14Days = new Date(Date.now() + 14 * 86_400_000);

  const [statusCounts, expiringSoon, ordersToday, revenueToday, mrrSubs, openTickets, activeTenants, ordersTodayByTenant] =
    await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
      prisma.subscription.count({ where: { currentEnd: { lte: in14Days, gte: new Date() }, cancelAtEnd: false } }),
      prisma.order.count({ where: { placedAt: { gte: dayStart } } }),
      prisma.order.aggregate({ where: { placedAt: { gte: dayStart }, payStatus: "paid" }, _sum: { totalPaise: true } }),
      prisma.subscription.findMany({ where: { status: "active" }, include: { plan: true } }),
      prisma.ticket.count({ where: { state: { not: "resolved" } } }),
      prisma.tenant.findMany({ where: { deletedAt: null, status: { in: ["trial", "active"] } }, select: { id: true } }),
      prisma.order.groupBy({ by: ["tenantId"], where: { placedAt: { gte: dayStart } }, _count: true }),
    ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<string, number>;
  const tenantsWithOrdersToday = new Set(ordersTodayByTenant.map((r) => r.tenantId));
  const zeroOrderCafes = activeTenants.filter((t) => !tenantsWithOrdersToday.has(t.id)).length;

  return {
    totalCafes: statusCounts.reduce((s, c) => s + c._count, 0),
    active: byStatus.active ?? 0,
    trial: byStatus.trial ?? 0,
    paused: byStatus.paused ?? 0,
    expiringSoon,
    ordersToday,
    revenueTodayPaise: revenueToday._sum.totalPaise ?? 0,
    mrrPaise: mrrSubs.reduce((s, sub) => s + sub.plan.pricePaise, 0),
    openTickets,
    zeroOrderCafes,
  };
}

/** Cheap counts for the nav rail badges — two count queries, no joins. */
export async function getRailCounts(): Promise<{ openTickets: number; attention: number }> {
  const dayStart = istDayStart();
  const [openTickets, activeTenants, tenantsWithOrders] = await Promise.all([
    prisma.ticket.count({ where: { state: { not: "resolved" } } }),
    prisma.tenant.count({ where: { deletedAt: null, status: "active" } }),
    prisma.order.groupBy({ by: ["tenantId"], where: { placedAt: { gte: dayStart } } }),
  ]);
  return { openTickets, attention: Math.max(0, activeTenants - tenantsWithOrders.length) };
}

/** Orders per day for the last 30 days, platform-wide (HQ-PORTAL-SPEC.md §4 charts). */
export async function getOrdersPerDay(days = 30): Promise<{ dateKey: string; orders: number }[]> {
  const start = new Date(istDayStart().getTime() - (days - 1) * 86_400_000);
  const orders = await prisma.order.findMany({ where: { placedAt: { gte: start } }, select: { placedAt: true } });
  return Array.from({ length: days }, (_, i) => {
    const from = new Date(start.getTime() + i * 86_400_000);
    const to = new Date(from.getTime() + 86_400_000);
    return {
      dateKey: from.toISOString().slice(0, 10),
      orders: orders.filter((o) => o.placedAt >= from && o.placedAt < to).length,
    };
  });
}

/** New cafes per month for the last 12 months. */
export async function getCafesPerMonth(months = 12): Promise<{ label: string; count: number }[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const tenants = await prisma.tenant.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } });
  return Array.from({ length: months }, (_, i) => {
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return {
      label: from.toLocaleDateString("en-IN", { month: "short" }),
      count: tenants.filter((t) => t.createdAt >= from && t.createdAt < to).length,
    };
  });
}

export async function getRecentActivity(limit = 30): Promise<ActivityFeedRow[]> {
  const rows = await prisma.activityLog.findMany({
    orderBy: { at: "desc" },
    take: limit,
    include: { tenant: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id.toString(),
    actorEmail: r.actorEmail,
    tenantName: r.tenant?.name ?? null,
    action: r.action,
    summary: r.summary,
    at: r.at.toISOString(),
  }));
}

export async function getNeedsAttention(): Promise<NeedsAttentionRow[]> {
  const in14Days = new Date(Date.now() + 14 * 86_400_000);
  const dayStart = istDayStart();
  const day1Ago = new Date(Date.now() - 1 * 86_400_000);

  const [expiring, oldTickets, quietTenants] = await Promise.all([
    prisma.subscription.findMany({
      where: { currentEnd: { lte: in14Days, gte: new Date() }, cancelAtEnd: false },
      include: { tenant: { select: { id: true, name: true } } },
    }),
    prisma.ticket.findMany({
      where: { state: { not: "resolved" }, createdAt: { lte: day1Ago } },
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.tenant.findMany({
      where: { deletedAt: null, status: "active" },
      select: { id: true, name: true, orders: { where: { placedAt: { gte: dayStart } }, take: 1, select: { id: true } } },
    }),
  ]);

  const rows: NeedsAttentionRow[] = [];
  for (const s of expiring) {
    const days = Math.max(0, Math.ceil((s.currentEnd.getTime() - Date.now()) / 86_400_000));
    rows.push({ kind: "expiring_sub", tenantId: s.tenant.id, tenantName: s.tenant.name, detail: `Subscription ends in ${days}d` });
  }
  for (const t of oldTickets) {
    if (!t.tenant) continue;
    rows.push({ kind: "old_ticket", tenantId: t.tenant.id, tenantName: t.tenant.name, detail: `Ticket ${t.code} open 24h+` });
  }
  for (const t of quietTenants) {
    if (t.orders.length === 0) rows.push({ kind: "quiet_cafe", tenantId: t.id, tenantName: t.name, detail: "No orders today" });
  }
  return rows;
}
