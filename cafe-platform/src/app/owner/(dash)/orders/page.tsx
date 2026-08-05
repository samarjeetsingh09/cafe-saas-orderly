import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getBoardData } from "@/lib/owner-board";
import { OrdersBoard } from "@/components/owner/OrdersBoard";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");

  const { stats, orders } = await getBoardData(profile.tenantId);
  return <OrdersBoard initialStats={stats} initialOrders={orders} role={profile.role} />;
}
