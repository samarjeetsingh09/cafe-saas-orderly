import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";
import { snapshotCafeAsTemplate } from "@/lib/hq-templates";
import { prisma } from "@/lib/db";

const Body = z.object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("manageTemplates");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const template = await snapshotCafeAsTemplate(id, parsed.data.name, parsed.data.description);
  await logActivity(prisma, guard.user, {
    tenantId: id,
    action: "template.created",
    target: `template:${template.id}`,
    summary: `${guard.user.fullName} saved a template "${template.name}" from this cafe`,
  });

  return NextResponse.json({ template }, { status: 201 });
}
