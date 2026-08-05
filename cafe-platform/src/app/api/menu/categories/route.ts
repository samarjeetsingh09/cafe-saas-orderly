import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  isVeg: z.boolean(),
});

export async function POST(request: Request) {
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

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const dupe = await prisma.category.findFirst({
    where: { tenantId: profile.tenantId, name: { equals: parsed.data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json({ error: "That category already exists" }, { status: 409 });
  }

  const count = await prisma.category.count({ where: { tenantId: profile.tenantId } });
  const category = await prisma.category.create({
    data: { tenantId: profile.tenantId, name: parsed.data.name, isVeg: parsed.data.isVeg, sortOrder: count },
  });
  await auditIfImpersonated(profile, "menu.category_created", `created category "${category.name}"`, { categoryId: category.id });

  return NextResponse.json({ category }, { status: 201 });
}
