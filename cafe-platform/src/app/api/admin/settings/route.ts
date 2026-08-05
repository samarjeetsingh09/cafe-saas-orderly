import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  defaultGstPercent: z.number().min(0).max(28),
  defaultTrialDays: z.number().int().min(0).max(365),
  defaultTableCount: z.number().int().min(1).max(200),
  defaultPlanId: z.string().nullable(),
  defaultSplitKitchen: z.boolean(),
  supportSlaHours: z.number().int().min(1).max(240),
});

/** Platform defaults (HQ-PORTAL-SPEC.md §13). super_admin only. */
export async function PATCH(request: Request) {
  const guard = await requireHq("managePlatformUsers");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { defaultPlanId, ...rest } = parsed.data;
  if (defaultPlanId) {
    const plan = await prisma.plan.findUnique({ where: { id: defaultPlanId }, select: { id: true } });
    if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.platformSetting.upsert({
      where: { id: "global" },
      update: { ...rest, defaultPlanId },
      create: { id: "global", ...rest, defaultPlanId },
    });
    await logActivity(tx, guard.user, {
      action: "settings.updated",
      target: "platform_settings:global",
      summary: `${guard.user.fullName} updated the platform defaults`,
      meta: parsed.data,
    });
  });

  return NextResponse.json({ ok: true });
}
