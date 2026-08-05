import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  cafeName: z.string().trim().min(1).max(80),
  ownerName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().max(60).optional(),
  source: z.enum(["website", "referral", "walk_in", "instagram"]).optional(),
  notes: z.string().trim().max(1000).optional(),
  nextFollowUp: z.string().optional(),
});

export async function POST(request: Request) {
  const guard = await requireHq("viewDashboard");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const d = parsed.data;

  const lead = await prisma.salesLead.create({
    data: {
      cafeName: d.cafeName,
      ownerName: d.ownerName,
      phone: d.phone,
      email: d.email || null,
      city: d.city || null,
      source: d.source,
      notes: d.notes || null,
      nextFollowUp: d.nextFollowUp ? new Date(d.nextFollowUp) : null,
      ownerUserId: guard.user.id,
    },
  });

  await logActivity(prisma, guard.user, {
    action: "lead.created",
    target: `lead:${lead.id}`,
    summary: `${guard.user.fullName} added ${lead.cafeName} to the pipeline`,
  });

  return NextResponse.json({ lead }, { status: 201 });
}
