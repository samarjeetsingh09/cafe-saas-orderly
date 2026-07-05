import { prisma } from "@/lib/db";

/**
 * Owner dashboard aggregates (M6). "Today" is the cafe's business day in
 * IST (UTC+05:30, no DST) regardless of server timezone.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** UTC instant of today's 00:00 IST. */
export function istDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export type TodayStats = {
  todayTotal: number; // all money-confirmed orders: paid + cash_pending + collected
  onlinePaid: number;
  cashPending: number;
  cashCollected: number;
  orderCount: number;
};

export async function getTodayStats(cafeId: string): Promise<TodayStats> {
  const since = istDayStart();
  const groups = await prisma.order.groupBy({
    by: ["paymentStatus"],
    where: { cafeId, createdAt: { gte: since } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  const sum = (status: string) =>
    Number(groups.find((g) => g.paymentStatus === status)?._sum.totalAmount ?? 0);

  const onlinePaid = sum("paid");
  const cashPending = sum("cash_pending");
  const cashCollected = sum("collected");
  return {
    todayTotal: onlinePaid + cashPending + cashCollected, // payment_pending excluded — unconfirmed
    onlinePaid,
    cashPending,
    cashCollected,
    orderCount: groups
      .filter((g) => g.paymentStatus !== "payment_pending")
      .reduce((n, g) => n + g._count._all, 0),
  };
}
