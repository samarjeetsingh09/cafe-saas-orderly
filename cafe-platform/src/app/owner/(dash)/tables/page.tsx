import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getTablesFloor } from "@/lib/owner-tables";
import { TablesFloor } from "@/components/owner/TablesFloor";
import { can } from "@/lib/permissions";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");

  const tables = await getTablesFloor(profile.tenantId);
  return <TablesFloor tables={tables} canTakeOrder={can(profile.role, "takeOrder")} />;
}
