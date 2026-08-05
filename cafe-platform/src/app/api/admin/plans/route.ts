import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, "Lowercase letters, digits, dash and underscore only"),
  name: z.string().trim().min(2).max(40),
  priceRupees: z.number().min(0).max(1_000_000),
  maxTables: z.number().int().min(1).max(500),
  features: z.array(z.string().trim().max(60)).max(12).default([]),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

/** Create a plan (HQ-PORTAL-SPEC.md §13). super_admin only. */
export async function POST(request: Request) {
  const guard = await requireHq("managePlatformUsers");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  const { id, name, priceRupees, maxTables, features, sortOrder } = parsed.data;
  const clash = await prisma.plan.findUnique({ where: { id }, select: { id: true } });
  if (clash) return NextResponse.json({ error: "A plan with that id already exists" }, { status: 409 });

  const plan = await prisma.plan.create({
    data: { id, name, pricePaise: Math.round(priceRupees * 100), maxTables, features, sortOrder },
  });
  await logActivity(prisma, guard.user, {
    action: "plan.created",
    target: `plan:${plan.id}`,
    summary: `${guard.user.fullName} created the ${plan.name} plan at ₹${priceRupees}/mo`,
  });

  return NextResponse.json({ ok: true, id: plan.id });
}
