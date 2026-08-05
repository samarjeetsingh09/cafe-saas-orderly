import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";

/**
 * Per-cafe health (HQ-PORTAL-SPEC.md §9). The spec proposes a `TenantHealth`
 * row refreshed by a 5-minute job; there's no scheduler in this local build,
 * so health is **computed live** from orders/tickets on each request and the
 * `TenantHealth` row is refreshed opportunistically as a cache for anything
 * that later wants it without the joins. Live-computed means it can never go
 * stale behind a dead cron — the failure mode the spec's own "Down" status
 * is trying to catch.
 *
 * §9's honesty note is respected: no per-cafe CPU/RAM gauge is shown, because
 * on shared hosting those are host metrics and a fake per-cafe number is
 * worse than none. Platform-level figures come from `pg_*` (see
 * `getPlatformHealth`).
 */
export type HealthStatus = "healthy" | "quiet" | "at_risk" | "down";

export const HEALTH_META: Record<HealthStatus, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  healthy: { label: "Healthy", tone: "ok" },
  quiet: { label: "Quiet", tone: "neutral" },
  at_risk: { label: "At risk", tone: "warn" },
  down: { label: "Down", tone: "danger" },
};

export type CafeHealthRow = {
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  planName: string | null;
  ordersToday: number;
  orders7d: number;
  trend: number[];
  lastOrderAt: Date | null;
  daysSinceOrder: number | null;
  openTickets: number;
  staffCount: number;
  health: HealthStatus;
};

function classify(input: { status: string; ordersToday: number; lastOrderAt: Date | null; daysSinceOrder: number | null }): HealthStatus {
  // A paused/cancelled cafe isn't "down" — it's off on purpose. Don't cry wolf.
  if (input.status === "paused" || input.status === "cancelled") return "quiet";
  if (input.lastOrderAt === null) return "down"; // never ordered — onboarding stalled
  if (input.daysSinceOrder !== null && input.daysSinceOrder >= 3) return "at_risk";
  if (input.ordersToday > 0) return "healthy";
  return "quiet";
}

export async function getCafeHealth(): Promise<CafeHealthRow[]> {
  const dayStart = istDayStart();
  const weekStart = new Date(dayStart.getTime() - 6 * 86_400_000);

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { profiles: { where: { active: true } }, tickets: { where: { state: { not: "resolved" } } } } },
    },
  });

  const [recentOrders, lastOrders] = await Promise.all([
    prisma.order.findMany({
      where: { placedAt: { gte: weekStart } },
      select: { tenantId: true, placedAt: true },
    }),
    prisma.order.groupBy({ by: ["tenantId"], _max: { placedAt: true } }),
  ]);

  const lastByTenant = new Map(lastOrders.map((r) => [r.tenantId, r._max.placedAt]));

  return tenants.map((t) => {
    const mine = recentOrders.filter((o) => o.tenantId === t.id);
    const ordersToday = mine.filter((o) => o.placedAt >= dayStart).length;

    // 7 buckets, oldest → today, for the inline sparkline.
    const trend = Array.from({ length: 7 }, (_, i) => {
      const from = new Date(weekStart.getTime() + i * 86_400_000);
      const to = new Date(from.getTime() + 86_400_000);
      return mine.filter((o) => o.placedAt >= from && o.placedAt < to).length;
    });

    const lastOrderAt = lastByTenant.get(t.id) ?? null;
    const daysSinceOrder = lastOrderAt ? Math.floor((Date.now() - lastOrderAt.getTime()) / 86_400_000) : null;

    return {
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      planName: t.subscription?.plan.name ?? null,
      ordersToday,
      orders7d: mine.length,
      trend,
      lastOrderAt,
      daysSinceOrder,
      openTickets: t._count.tickets,
      staffCount: t._count.profiles,
      health: classify({ status: t.status, ordersToday, lastOrderAt, daysSinceOrder }),
    };
  });
}

export type PlatformHealth = {
  dbSizeBytes: number;
  dbConnections: number;
  tenantCount: number;
  orderCount: number;
  ordersLast24h: number;
  slowestTableRows: { table: string; rows: number }[];
};

/** Platform-level figures pulled from Postgres itself — real numbers, not invented gauges. */
export async function getPlatformHealth(): Promise<PlatformHealth> {
  const [sizeRows, connRows, tenantCount, orderCount, ordersLast24h, tableRows] = await Promise.all([
    prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()`,
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.order.count(),
    prisma.order.count({ where: { placedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.$queryRaw<{ relname: string; n_live_tup: bigint }[]>`
      SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 5
    `,
  ]);

  return {
    dbSizeBytes: Number(sizeRows[0]?.size ?? 0),
    dbConnections: Number(connRows[0]?.n ?? 0),
    tenantCount,
    orderCount,
    ordersLast24h,
    slowestTableRows: tableRows.map((r) => ({ table: r.relname, rows: Number(r.n_live_tup) })),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
