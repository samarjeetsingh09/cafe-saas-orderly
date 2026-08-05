import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getPlanData, daysUntil } from "@/lib/owner-plan";
import { PlanView } from "@/components/owner/PlanView";
import { can } from "@/lib/permissions";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");
  if (!can(profile.role, "manageBilling")) redirect("/owner/orders");

  const { plans, subscription, invoices } = await getPlanData(profile.tenantId);
  const daysLeft = subscription ? daysUntil(subscription.currentEnd) : 0;
  return <PlanView plans={plans} subscription={subscription} invoices={invoices} canManage={can(profile.role, "manageBilling")} daysLeft={daysLeft} />;
}
