import { prisma } from "@/lib/db";
import { istDayStart } from "@/lib/owner-stats";

/** Serializable order row for the owner Orders feed (Decimal → number). */
export type OwnerOrderDTO = {
  id: string;
  orderNumber: number;
  tableNumber: string;
  customerName: string;
  paymentMode: "online" | "cash";
  paymentStatus: "payment_pending" | "paid" | "cash_pending" | "collected";
  totalAmount: number;
  createdAt: string; // ISO
  items: { name: string; quantity: number }[];
};

export async function getTodayOrders(cafeId: string): Promise<OwnerOrderDTO[]> {
  const orders = await prisma.order.findMany({
    where: { cafeId, createdAt: { gte: istDayStart() } },
    orderBy: { createdAt: "desc" },
    include: {
      table: { select: { tableNumber: true } },
      orderItems: { select: { itemNameSnapshot: true, quantity: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    tableNumber: o.table.tableNumber,
    customerName: o.customerName,
    paymentMode: o.paymentMode,
    paymentStatus: o.paymentStatus,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    items: o.orderItems.map((i) => ({ name: i.itemNameSnapshot, quantity: i.quantity })),
  }));
}
