import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";
import { createTicket } from "@/lib/owner-support";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

/**
 * plan/START-HERE.md Phase H #6: "Upgrade creates a support ticket instead
 * of charging anything." Never mutates `Subscription` — the request is
 * fulfilled by a human on the other end of the ticket, same for an upgrade
 * or a downgrade.
 */
const Body = z.object({ planId: z.string().min(1) });

export async function POST(request: Request) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }
  if (!can(profile.role, "manageBilling")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [targetPlan, subscription] = await Promise.all([
    prisma.plan.findUnique({ where: { id: parsed.data.planId } }),
    prisma.subscription.findUnique({ where: { tenantId: profile.tenantId }, include: { plan: true } }),
  ]);
  if (!targetPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const fromName = subscription?.plan.name ?? "your current plan";
  const up = subscription ? targetPlan.sortOrder > subscription.plan.sortOrder : true;

  const ticket = await createTicket(profile.tenantId, profile.id, {
    topic: "Payments & settlement",
    subject: `${up ? "Upgrade" : "Switch"} to ${targetPlan.name} plan`,
    priority: "normal",
    body: `Requesting to move from ${fromName} to ${targetPlan.name} — ₹${Math.round(targetPlan.pricePaise / 100)}/month. Sent from the dashboard.`,
  });
  await auditIfImpersonated(profile, "plan.change_requested", `requested ${up ? "upgrade" : "switch"} to ${targetPlan.name}`, { planId: targetPlan.id });

  return NextResponse.json({ ticket }, { status: 201 });
}
