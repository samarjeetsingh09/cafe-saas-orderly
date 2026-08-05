import { prisma } from "@/lib/db";
import { listTemplates } from "@/lib/hq-templates";
import { ProvisionWizard } from "@/components/admin/ProvisionWizard";
import { PageHeader } from "@/components/admin/ui";
import { getPlatformSettings } from "@/lib/hq-settings";

export const dynamic = "force-dynamic";

type Params = {
  templateId?: string;
  /** Lead-conversion prefill, written by LeadsBoard's "Convert to cafe". */
  leadId?: string;
  name?: string;
  owner?: string;
  phone?: string;
  email?: string;
};

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const { templateId, leadId, name, owner, phone, email } = await searchParams;
  const [plans, templates, settings] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    listTemplates(),
    getPlatformSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Provision a cafe"
        subtitle={leadId ? "Converting a pipeline lead — details prefilled below." : "Seven steps. The draft survives a refresh."}
        back={{ href: leadId ? "/admin/leads" : "/admin/cafes", label: leadId ? "Pipeline" : "Cafes" }}
      />
      <ProvisionWizard
        plans={plans.map((p) => ({ id: p.id, name: p.name, pricePaise: p.pricePaise, maxTables: p.maxTables }))}
        templates={templates}
        initialTemplateId={templateId}
        lead={leadId ? { id: leadId, name: name ?? "", owner: owner ?? "", phone: phone ?? "", email: email ?? "" } : undefined}
        defaults={{
          defaultGstPercent: settings.defaultGstPercent,
          defaultTrialDays: settings.defaultTrialDays,
          defaultTableCount: settings.defaultTableCount,
          defaultPlanId: settings.defaultPlanId,
          defaultSplitKitchen: settings.defaultSplitKitchen,
        }}
      />
    </>
  );
}
