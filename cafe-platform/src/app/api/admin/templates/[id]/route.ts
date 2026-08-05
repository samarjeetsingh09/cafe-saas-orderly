import { NextResponse } from "next/server";
import { requireHq } from "@/lib/hq-guard";
import { deleteTemplate } from "@/lib/hq-templates";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("manageTemplates");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  await deleteTemplate(id);
  return NextResponse.json({ ok: true });
}
