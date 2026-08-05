import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";
import { boardOrderInclude, toBoardOrderDTO, type BoardOrderDTO } from "@/lib/owner-board";

/**
 * Kitchen display data (Phase G) — plan/bella-kitchen-display.html.
 * Tickets reuse `BoardOrderDTO` as-is (code, table, stage, items, note,
 * readyAt is already everything a ticket needs) so the kitchen can share
 * `useLiveOrders` with the console, per plan/CLAUDE-CODE-BRIEF.md's "one
 * sync path" rule — no separate ticket type to keep in sync.
 */
export async function getKitchenTickets(tenantId: string): Promise<BoardOrderDTO[]> {
  const since = istDayStart();
  const orders = await prisma.order.findMany({
    where: { tenantId, placedAt: { gte: since }, stage: { in: ["new", "preparing", "ready"] } },
    orderBy: { placedAt: "asc" },
    include: boardOrderInclude,
  });
  return orders.map(toBoardOrderDTO);
}

export type KitchenMenuItem = { id: string; name: string; available: boolean };
export type KitchenMenuGroup = { categoryId: string; categoryName: string; isVeg: boolean; items: KitchenMenuItem[] };

/** Powers the 86 sheet — every dish, grouped by category, so a cook can flip availability. */
export async function getKitchenMenu(tenantId: string): Promise<KitchenMenuGroup[]> {
  const categories = await prisma.category.findMany({
    where: { tenantId, active: true },
    orderBy: { sortOrder: "asc" },
    include: { menuItems: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, available: true } } },
  });
  return categories
    .filter((c) => c.menuItems.length > 0)
    .map((c) => ({ categoryId: c.id, categoryName: c.name, isVeg: c.isVeg, items: c.menuItems }));
}
