import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getTickets } from "@/lib/owner-support";
import { SupportView } from "@/components/owner/SupportView";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");

  const tickets = await getTickets(profile.tenantId);
  return <SupportView initialTickets={tickets} />;
}
