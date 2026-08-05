import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";
import type { OrderChannel, OrderStage, OrderStation, PayMethod, PayStatus } from "@prisma/client";

/**
 * Data for the live orders board (Phase D) — plan/bella-admin-console.html's
 * "Live orders" tab. "Today" is the cafe's IST business day, same boundary
 * as the (not-yet-rebuilt) Reports tab uses.
 *
 * `boardOrderInclude`/`toBoardOrderDTO` are also used by Phase F's
 * `lib/orders.ts` when a customer places an order, so the console board and
 * the order-just-placed response are always shaped identically — no second
 * DTO to keep in sync.
 */

export type BoardOrderDTO = {
  id: string;
  code: string;
  tableLabel: string;
  station: OrderStation;
  channel: OrderChannel;
  placedByName: string | null;
  note: string | null;
  stage: OrderStage;
  payMethod: PayMethod;
  payStatus: PayStatus;
  totalPaise: number;
  placedAt: string;
  /** Set when `stage` first becomes `ready` — Phase G's kitchen ready-rail wait time. */
  readyAt: string | null;
  items: { name: string; variantLabel: string; qty: number }[];
};

export const boardOrderInclude = {
  items: { select: { name: true, variantLabel: true, qty: true } },
  placedByProfile: { select: { fullName: true } },
} satisfies Prisma.OrderInclude;

type OrderWithBoardIncludes = Prisma.OrderGetPayload<{ include: typeof boardOrderInclude }>;

export function toBoardOrderDTO(o: OrderWithBoardIncludes): BoardOrderDTO {
  return {
    id: o.id,
    code: o.code,
    tableLabel: o.tableLabel,
    station: o.station,
    channel: o.channel,
    placedByName: o.placedByProfile?.fullName ?? null,
    note: o.note,
    stage: o.stage,
    payMethod: o.payMethod,
    payStatus: o.payStatus,
    totalPaise: o.totalPaise,
    placedAt: o.placedAt.toISOString(),
    readyAt: o.readyAt ? o.readyAt.toISOString() : null,
    items: o.items,
  };
}

export type BoardStats = {
  activeOrders: number;
  todayOrders: number;
  todaySalesPaise: number;
  gstPercent: number;
  tablesRunning: number;
  totalTables: number;
  runningLateCount: number;
};

export type BoardData = { stats: BoardStats; orders: BoardOrderDTO[] };

export async function getBoardData(tenantId: string): Promise<BoardData> {
  const since = istDayStart();
  const [orders, totalTables, tenant] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, placedAt: { gte: since }, stage: { not: "cancelled" } },
      orderBy: { placedAt: "asc" },
      include: boardOrderInclude,
    }),
    prisma.cafeTable.count({ where: { tenantId, active: true } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { gstPercent: true } }),
  ]);

  const nowMs = Date.now();
  const active = orders.filter((o) => o.stage !== "served");
  const runningLateCount = active.filter((o) => (nowMs - o.placedAt.getTime()) / 60000 > 15).length;
  // A ticket only counts as a sale once the cafe has accepted it. Sitting in
  // `new` it is a request, not revenue — it can still be cancelled without a
  // rupee changing hands, and counting it made the figure jump the moment a
  // customer tapped "place order" and drop again on cancel.
  const todaySalesPaise = orders.filter((o) => o.stage !== "new").reduce((sum, o) => sum + o.totalPaise, 0);
  const tablesRunning = new Set(active.map((o) => o.tableLabel)).size;

  return {
    stats: {
      activeOrders: active.length,
      todayOrders: orders.length,
      todaySalesPaise,
      gstPercent: Number(tenant.gstPercent),
      tablesRunning,
      totalTables,
      runningLateCount,
    },
    orders: orders.map(toBoardOrderDTO),
  };
}

/** Powers the console nav's "Live orders" badge. */
export async function getNewOrderCount(tenantId: string): Promise<number> {
  return prisma.order.count({ where: { tenantId, stage: "new" } });
}
