import type { SalesLeadStage } from "@prisma/client";

/**
 * Pipeline stage constants, kept out of `hq-leads.ts` on purpose: that module
 * imports the Prisma client, and `LeadsBoard` is a client component. A *value*
 * import from a Prisma-importing module would drag the client into the browser
 * bundle; types are erased, so `import type` from there stays free.
 */
export const LEAD_STAGES: SalesLeadStage[] = ["lead", "demo", "negotiation", "won", "lost"];

export const STAGE_LABEL: Record<SalesLeadStage, string> = {
  lead: "Lead",
  demo: "Demo",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};
