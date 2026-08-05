import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({ versionId: z.string().uuid() });

/**
 * Revert a cafe's theme to a stored version (HQ-PORTAL-SPEC.md §12).
 *
 * A revert is itself a theme change, so it snapshots the current theme first —
 * the same rule the PATCH route follows. That makes "revert the revert" work
 * and keeps the history an honest record of every state the cafe was in.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("editBranding");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const [tenant, version] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, theme: true, deletedAt: true } }),
    prisma.themeVersion.findUnique({ where: { id: parsed.data.versionId } }),
  ]);
  if (!tenant || tenant.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!version || version.tenantId !== id) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.themeVersion.create({ data: { tenantId: id, theme: tenant.theme as object, savedById: guard.user.id } });
    const stale = await tx.themeVersion.findMany({ where: { tenantId: id }, orderBy: { savedAt: "desc" }, skip: 10, select: { id: true } });
    if (stale.length) await tx.themeVersion.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });

    await tx.tenant.update({ where: { id }, data: { theme: version.theme as object } });
    await logActivity(tx, guard.user, {
      tenantId: id,
      action: "theme.reverted",
      target: `tenant:${id}`,
      summary: `${guard.user.fullName} reverted ${tenant.name}'s theme to the ${version.savedAt.toISOString().slice(0, 16).replace("T", " ")} version`,
      meta: { versionId: version.id },
    });
  });

  return NextResponse.json({ ok: true });
}
