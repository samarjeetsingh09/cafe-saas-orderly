import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getMenuManagerData } from "@/lib/owner-menu";
import { MenuManager } from "@/components/owner/MenuManager";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");

  const categories = await getMenuManagerData(profile.tenantId);
  return <MenuManager initialCategories={categories} role={profile.role} />;
}
