import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";

/**
 * HQ Cafes list + detail (Phase I, HQ-PORTAL-SPEC.md §5) — read-only for now.
 * Row actions (edit, impersonate, suspend, clone, delete) land in later steps
 * of the spec's §14 build order.
 */
export type CafeListRow = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  status: string;
  version: string | null;
  createdAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  planId: string | null;
  planName: string | null;
  ordersToday: number;
};

export type CafeSort = "created" | "name" | "orders" | "status" | "plan";

export type CafeListFilters = {
  status?: string;
  planId?: string;
  noOrdersToday?: boolean;
  search?: string;
  sort?: CafeSort;
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type CafeListPage = {
  rows: CafeListRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

const SORTERS: Record<CafeSort, (a: CafeListRow, b: CafeListRow) => number> = {
  created: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  name: (a, b) => a.name.localeCompare(b.name),
  orders: (a, b) => a.ordersToday - b.ordersToday,
  status: (a, b) => a.status.localeCompare(b.status),
  plan: (a, b) => (a.planName ?? "").localeCompare(b.planName ?? ""),
};

/**
 * Sorting and paging happen in memory, deliberately: `ordersToday` and the
 * `noOrdersToday` filter are both derived from a per-row aggregate that
 * Postgres can't order the base query by without a join we'd then have to
 * re-filter anyway. HQ lists tenants — tens to low hundreds — so one full
 * fetch per page view is cheaper than the query gymnastics, and it keeps every
 * column sortable rather than only the ones that map to a scalar.
 */
export async function listCafes(filters: CafeListFilters = {}): Promise<CafeListPage> {
  const dayStart = istDayStart();
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.planId ? { subscription: { planId: filters.planId } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { slug: { contains: filters.search, mode: "insensitive" } },
              { profiles: { some: { role: "owner", OR: [{ email: { contains: filters.search, mode: "insensitive" } }] } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: true } },
      profiles: { where: { role: "owner" }, take: 1, orderBy: { createdAt: "asc" } },
      _count: { select: { orders: { where: { placedAt: { gte: dayStart } } } } },
    },
  });

  const rows = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    logoUrl: t.logoUrl,
    status: t.status,
    version: t.version,
    createdAt: t.createdAt,
    ownerName: t.profiles[0]?.fullName ?? null,
    ownerEmail: t.profiles[0]?.email ?? null,
    ownerPhone: t.phone,
    planId: t.subscription?.planId ?? null,
    planName: t.subscription?.plan.name ?? null,
    ordersToday: t._count.orders,
  }));

  const filtered = filters.noOrdersToday ? rows.filter((r) => r.ordersToday === 0) : rows;

  const sorted = [...filtered].sort(SORTERS[filters.sort ?? "created"]);
  if ((filters.dir ?? "desc") === "desc") sorted.reverse();

  const perPage = filters.perPage ?? 25;
  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  return {
    rows: sorted.slice((page - 1) * perPage, page * perPage),
    total: sorted.length,
    page,
    perPage,
    pageCount,
  };
}

export type CafeDetail = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  status: string;
  version: string | null;
  createdAt: Date;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  gstPercent: string;
  splitKitchen: boolean;
  timezone: string;
  trialEndsAt: Date | null;
  goLiveAt: Date | null;
  subscription: {
    planName: string;
    planId: string;
    pricePaise: number;
    status: string;
    currentStart: Date;
    currentEnd: Date;
    cancelAtEnd: boolean;
    /** Precomputed here, not in the page: `Date.now()` during render is impure. */
    daysLeft: number;
  } | null;
  tableCount: number;
  categoryCount: number;
  menuItemCount: number;
  users: { id: string; fullName: string; email: string; role: string; station: string | null; active: boolean; createdAt: Date }[];
  openTicketCount: number;
  ordersToday: number;
  /** Last 30 days — the honest read on whether this cafe is actually trading. */
  orders30d: number;
  revenue30dPaise: number;
  lastOrderAt: Date | null;
  themeVersionCount: number;
};

export async function getCafeDetail(tenantId: string): Promise<CafeDetail | null> {
  const dayStart = istDayStart();
  const from30d = new Date(dayStart.getTime() - 29 * 86_400_000);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: true } },
      profiles: { orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
      _count: {
        select: {
          cafeTables: true,
          categories: true,
          menuItems: true,
          orders: { where: { placedAt: { gte: dayStart } } },
          tickets: { where: { state: { not: "resolved" } } },
          themeVersions: true,
        },
      },
    },
  });
  if (!tenant) return null;

  const [last30, lastOrder] = await Promise.all([
    prisma.order.aggregate({
      where: { tenantId, placedAt: { gte: from30d } },
      _count: true,
      _sum: { totalPaise: true },
    }),
    prisma.order.findFirst({ where: { tenantId }, orderBy: { placedAt: "desc" }, select: { placedAt: true } }),
  ]);

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    status: tenant.status,
    version: tenant.version,
    createdAt: tenant.createdAt,
    phone: tenant.phone,
    address: tenant.address,
    gstNumber: tenant.gstNumber,
    gstPercent: tenant.gstPercent.toString(),
    splitKitchen: tenant.splitKitchen,
    timezone: tenant.timezone,
    trialEndsAt: tenant.trialEndsAt,
    goLiveAt: tenant.goLiveAt,
    subscription: tenant.subscription
      ? {
          planName: tenant.subscription.plan.name,
          planId: tenant.subscription.planId,
          pricePaise: tenant.subscription.plan.pricePaise,
          status: tenant.subscription.status,
          currentStart: tenant.subscription.currentStart,
          currentEnd: tenant.subscription.currentEnd,
          cancelAtEnd: tenant.subscription.cancelAtEnd,
          daysLeft: Math.ceil((tenant.subscription.currentEnd.getTime() - Date.now()) / 86_400_000),
        }
      : null,
    tableCount: tenant._count.cafeTables,
    categoryCount: tenant._count.categories,
    menuItemCount: tenant._count.menuItems,
    users: tenant.profiles.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      role: p.role,
      station: p.station,
      active: p.active,
      createdAt: p.createdAt,
    })),
    openTicketCount: tenant._count.tickets,
    ordersToday: tenant._count.orders,
    orders30d: last30._count,
    revenue30dPaise: last30._sum.totalPaise ?? 0,
    lastOrderAt: lastOrder?.placedAt ?? null,
    themeVersionCount: tenant._count.themeVersions,
  };
}
