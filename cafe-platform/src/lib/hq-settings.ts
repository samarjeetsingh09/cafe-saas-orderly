import { prisma } from "@/lib/db";

/**
 * Platform defaults (HQ-PORTAL-SPEC.md §13). One row, id `global`, created on
 * first read rather than seeded — the app must work against a database that
 * predates this table without anyone remembering to run a fixup.
 */
export type PlatformDefaults = {
  defaultGstPercent: number;
  defaultTrialDays: number;
  defaultTableCount: number;
  defaultPlanId: string | null;
  defaultSplitKitchen: boolean;
  supportSlaHours: number;
};

export async function getPlatformSettings(): Promise<PlatformDefaults> {
  const row = await prisma.platformSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  return {
    defaultGstPercent: Number(row.defaultGstPercent),
    defaultTrialDays: row.defaultTrialDays,
    defaultTableCount: row.defaultTableCount,
    defaultPlanId: row.defaultPlanId,
    defaultSplitKitchen: row.defaultSplitKitchen,
    supportSlaHours: row.supportSlaHours,
  };
}
