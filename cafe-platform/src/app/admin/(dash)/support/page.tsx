import { prisma } from "@/lib/db";
import { listTicketsHq } from "@/lib/hq-support";
import { getPlatformSettings } from "@/lib/hq-settings";
import { getPlatformUser } from "@/lib/session";
import { SupportInboxHq } from "@/components/admin/SupportInboxHq";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await getPlatformSettings();
  const [tickets, hqUsers, user] = await Promise.all([
    listTicketsHq({}, settings.supportSlaHours),
    // Only active accounts can be assigned — the PATCH route enforces the
    // same rule, so a deactivated colleague can never hold a queue.
    prisma.platformUser.findMany({ where: { active: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    getPlatformUser(),
  ]);

  return (
    <>
      <PageHeader title="Support inbox" subtitle={`First-response SLA is ${settings.supportSlaHours}h — change it in Settings`} />
      <SupportInboxHq initialTickets={tickets} hqUsers={hqUsers} currentUserId={user!.id} slaHours={settings.supportSlaHours} />
    </>
  );
}
