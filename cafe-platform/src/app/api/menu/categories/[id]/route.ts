import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

/** Cascades to its dishes and their variants (schema `onDelete: Cascade`). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }
  if (!can(profile.role, "editMenu")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.category.findFirst({ where: { id, tenantId: profile.tenantId }, select: { name: true } });
  const deleted = await prisma.category.deleteMany({ where: { id, tenantId: profile.tenantId } });
  if (deleted.count !== 1) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  await auditIfImpersonated(profile, "menu.category_deleted", `deleted category "${target?.name}"`, { categoryId: id });
  return NextResponse.json({ ok: true });
}
