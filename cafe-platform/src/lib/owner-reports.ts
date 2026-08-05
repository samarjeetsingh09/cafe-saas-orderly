import { prisma } from "@/lib/db";

/**
 * Reports tab (Phase H #5) — plan/bella-admin-console.html's per-day sales,
 * computed from real orders instead of the prototype's seeded `HISTORY`
 * array. "Day" is the cafe's IST business day, same boundary as the board
 * (`lib/owner-board.ts`) and kitchen (`lib/kitchen.ts`) use for "today".
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type DayRow = { dateKey: string; atMs: number; orders: number; cashPaise: number; onlinePaise: number };

function istDateKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function istMidnightUtc(dateKey: string): number {
  return new Date(dateKey + "T00:00:00.000Z").getTime() - IST_OFFSET_MS;
}

export async function getReportsDays(tenantId: string, rangeDays: 7 | 14 | 30): Promise<DayRow[]> {
  const now = new Date();
  const todayKey = istDateKey(now);
  const startMs = istMidnightUtc(todayKey) - (rangeDays - 1) * 86_400_000;

  const orders = await prisma.order.findMany({
    where: { tenantId, placedAt: { gte: new Date(startMs) }, stage: { not: "cancelled" } },
    select: { placedAt: true, payMethod: true, totalPaise: true },
  });

  const buckets = new Map<string, DayRow>();
  for (let i = 0; i < rangeDays; i++) {
    const atMs = startMs + i * 86_400_000;
    const key = istDateKey(new Date(atMs));
    buckets.set(key, { dateKey: key, atMs, orders: 0, cashPaise: 0, onlinePaise: 0 });
  }
  for (const o of orders) {
    const key = istDateKey(o.placedAt);
    const b = buckets.get(key);
    if (!b) continue;
    b.orders += 1;
    if (o.payMethod === "cash") b.cashPaise += o.totalPaise;
    else b.onlinePaise += o.totalPaise;
  }

  return [...buckets.values()];
}
