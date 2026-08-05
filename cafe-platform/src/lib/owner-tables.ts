import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";

/** Tables floor (Phase H #3) — plan/bella-admin-console.html's `renderFloor()`, computed from today's live orders. */
export type TableCardDTO = {
  id: string;
  label: string;
  status: "free" | "busy" | "due";
  openOrders: number;
  billPaise: number;
};

export async function getTablesFloor(tenantId: string): Promise<TableCardDTO[]> {
  const since = istDayStart();
  const [tables, orders] = await Promise.all([
    prisma.cafeTable.findMany({ where: { tenantId, active: true }, orderBy: { label: "asc" }, select: { id: true, label: true } }),
    prisma.order.findMany({
      where: { tenantId, placedAt: { gte: since }, stage: { not: "cancelled" } },
      select: { tableId: true, stage: true, payMethod: true, payStatus: true, totalPaise: true },
    }),
  ]);

  return tables.map((t) => {
    const mine = orders.filter((o) => o.tableId === t.id);
    const open = mine.filter((o) => o.stage !== "served");
    const due = mine.filter((o) => o.stage === "served" && o.payMethod === "cash" && o.payStatus !== "paid");
    const billPaise = mine.reduce((s, o) => s + o.totalPaise, 0);
    const status: TableCardDTO["status"] = due.length ? "due" : open.length ? "busy" : "free";
    return { id: t.id, label: t.label, status, openOrders: open.length, billPaise };
  });
}
