import { getOwnerCafe } from "@/lib/session";
import { getTodayOrders } from "@/lib/owner-orders";
import { OrdersFeed } from "@/components/owner/OrdersFeed";

export const dynamic = "force-dynamic";

export default async function OwnerOrdersPage() {
  const cafe = (await getOwnerCafe())!;
  const orders = await getTodayOrders(cafe.id);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Today&apos;s orders, newest first.</p>
      <OrdersFeed initialOrders={orders} />
    </div>
  );
}
