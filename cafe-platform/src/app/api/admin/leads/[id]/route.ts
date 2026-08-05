import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  stage: z.enum(["lead", "demo", "negotiation", "won", "lost"]).optional(),
  lostReason: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  nextFollowUp: z.string().nullable().optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  email: z.string().trim().email().nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  // Set by the provisioning wizard when a lead is converted, so the row links
  // to the cafe it became (the board then shows "Open cafe" instead of
  // offering to convert it a second time).
  tenantId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("viewDashboard");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.salesLead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { nextFollowUp, ...rest } = parsed.data;
  const lead = await prisma.salesLead.update({
    where: { id },
    data: {
      ...rest,
      ...(nextFollowUp !== undefined ? { nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null } : {}),
    },
  });

  if (parsed.data.stage && parsed.data.stage !== existing.stage) {
    await logActivity(prisma, guard.user, {
      action: "lead.stage_changed",
      target: `lead:${id}`,
      summary: `${guard.user.fullName} moved ${lead.cafeName} to ${parsed.data.stage}`,
      meta: { from: existing.stage, to: parsed.data.stage },
    });
  }

  return NextResponse.json({ lead });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("viewDashboard");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const lead = await prisma.salesLead.findUnique({ where: { id }, select: { cafeName: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.salesLead.delete({ where: { id } });
  await logActivity(prisma, guard.user, {
    action: "lead.deleted",
    target: `lead:${id}`,
    summary: `${guard.user.fullName} removed ${lead.cafeName} from the pipeline`,
  });
  return NextResponse.json({ ok: true });
}
