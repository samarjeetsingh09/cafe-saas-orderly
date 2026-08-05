import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({ slugConfirm: z.string() });

/** Soft delete only (HQ-PORTAL-SPEC.md §5): status='cancelled' + deletedAt, data retained 90 days. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("suspendOrDeleteCafe");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, slug: true, deletedAt: true } });
  if (!tenant || tenant.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.slugConfirm.trim().toLowerCase() !== tenant.slug) {
    return NextResponse.json({ error: "Slug confirmation doesn't match" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id }, data: { status: "cancelled", deletedAt: new Date() } });
    await logActivity(tx, guard.user, {
      tenantId: id,
      action: "cafe.deleted",
      target: `tenant:${id}`,
      summary: `${guard.user.fullName} deleted ${tenant.name} (soft delete, 90-day retention)`,
    });
  });

  return NextResponse.json({ ok: true });
}
