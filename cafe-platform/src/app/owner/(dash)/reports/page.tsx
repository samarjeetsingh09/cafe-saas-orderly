import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getReportsDays } from "@/lib/owner-reports";
import { ReportsView } from "@/components/owner/ReportsView";
import { can } from "@/lib/permissions";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");
  if (!can(profile.role, "viewReports")) redirect("/owner/orders");

  const days = await getReportsDays(profile.tenantId, 7);
  return <ReportsView initialDays={days} initialRange={7} />;
}
