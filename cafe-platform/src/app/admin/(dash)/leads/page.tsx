import { listLeads } from "@/lib/hq-leads";
import { PageHeader } from "@/components/admin/ui";
import { LeadsBoard } from "@/components/admin/LeadsBoard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const leads = await listLeads();
  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Cafes you're talking to, before they're provisioned. Drag a card to move the deal along."
      />
      <LeadsBoard initial={leads} />
    </>
  );
}
