import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  gstNumber: z.string().trim().max(30).optional().nullable(),
  gstPercent: z.number().min(0).max(28).optional(),
  splitKitchen: z.boolean().optional(),
  theme: z.record(z.string(), z.string()).optional(),
  logoUrl: z.string().optional().nullable(),
});

/** Edit branding/contact/settings (HQ-PORTAL-SPEC.md §5 row action "Edit"). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("editBranding");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, theme: true, deletedAt: true } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  await prisma.$transaction(async (tx) => {
    // Snapshot the theme *before* overwriting it (HQ-PORTAL-SPEC.md §12
    // theme history + revert). Storing the previous value rather than the new
    // one means the newest history row is always "what it was before the last
    // save" — exactly what a revert needs to restore. Same transaction as the
    // update, so a rolled-back save can't leave a phantom version behind.
    if (data.theme) {
      await tx.themeVersion.create({
        data: { tenantId: id, theme: existing.theme as object, savedById: guard.user.id },
      });
      // Keep the last 10 (§12). Deleting by id, not by date arithmetic, so a
      // clock skew or a same-millisecond double save can't drop the wrong row.
      const keep = await tx.themeVersion.findMany({
        where: { tenantId: id },
        orderBy: { savedAt: "desc" },
        skip: 10,
        select: { id: true },
      });
      if (keep.length) await tx.themeVersion.deleteMany({ where: { id: { in: keep.map((k) => k.id) } } });
    }

    await tx.tenant.update({ where: { id }, data });
    await logActivity(tx, guard.user, {
      tenantId: id,
      action: "theme.updated",
      target: `tenant:${id}`,
      summary: `${guard.user.fullName} updated ${existing.name}'s branding/settings`,
      meta: { fields: Object.keys(data) },
    });
  });

  return NextResponse.json({ ok: true });
}
