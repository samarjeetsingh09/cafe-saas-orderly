import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({ active: z.boolean() });

/**
 * Deactivate / reactivate a cafe staff account (HQ-PORTAL-SPEC.md §1
 * `resetCafeUserPassword` capability — the same support-desk job as a reset:
 * a waiter left, kill their login now, without deleting the order history
 * attributed to them).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; profileId: string }> }) {
  const guard = await requireHq("resetCafeUserPassword");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id, profileId } = await params;
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, tenantId: true, fullName: true, email: true, role: true, tenant: { select: { name: true } } },
  });
  // Scoped to the cafe in the URL, not just "any profile with this id" — the
  // route is reachable with any tenant id, so the pairing has to be checked.
  if (!profile || profile.tenantId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({ where: { id: profileId }, data: { active: parsed.data.active } });
    await logActivity(tx, guard.user, {
      tenantId: id,
      action: parsed.data.active ? "cafe_user.reactivated" : "cafe_user.deactivated",
      target: `profile:${profileId}`,
      summary: `${guard.user.fullName} ${parsed.data.active ? "reactivated" : "deactivated"} ${profile.fullName} (${profile.role}) at ${profile.tenant.name}`,
    });
  });

  return NextResponse.json({ ok: true, active: parsed.data.active });
}
