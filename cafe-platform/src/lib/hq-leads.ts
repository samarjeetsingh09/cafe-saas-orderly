import { prisma } from "@/lib/db";
import type { SalesLeadStage, LeadSource } from "@prisma/client";

/**
 * Sales pipeline (HQ-PORTAL-SPEC.md §3) — "a pipeline board, not Salesforce".
 * Deliberately five columns and one card shape; conversion writes
 * `SalesLead.tenantId` and moves the stage to `won`.
 *
 * Note this is `SalesLead`, not the marketing site's `Lead` (NOTES.md
 * decision #3) — the two never merge.
 */
export { LEAD_STAGES, STAGE_LABEL } from "@/lib/hq-lead-stages";

export type LeadDTO = {
  id: string;
  cafeName: string;
  ownerName: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: LeadSource | null;
  stage: SalesLeadStage;
  lostReason: string | null;
  notes: string | null;
  nextFollowUp: string | null;
  tenantId: string | null;
  ownerUserName: string | null;
  createdAt: string;
};

export async function listLeads(): Promise<LeadDTO[]> {
  const rows = await prisma.salesLead.findMany({
    orderBy: [{ nextFollowUp: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { ownerUser: { select: { fullName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    cafeName: r.cafeName,
    ownerName: r.ownerName,
    phone: r.phone,
    email: r.email,
    city: r.city,
    source: r.source,
    stage: r.stage,
    lostReason: r.lostReason,
    notes: r.notes,
    nextFollowUp: r.nextFollowUp ? r.nextFollowUp.toISOString() : null,
    tenantId: r.tenantId,
    ownerUserName: r.ownerUser?.fullName ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
