import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";
import { PROFILE_COOKIE, impersonationCookieOptions, signImpersonationToken } from "@/lib/auth";

const Body = z.object({ reason: z.string().trim().min(1).max(200) });

/**
 * "Login as owner" (HQ-PORTAL-SPEC.md §8) — the single most useful feature
 * here, and the easiest to get wrong. Hard 60-minute cap (baked into the JWT
 * itself, not just the UI banner), required reason, both identities in the
 * activity log, and impersonation can never touch billing (no route here
 * changes `Subscription`/`PaymentConfig` — those stay under super_admin in
 * HQ only).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("impersonate");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  const { id: tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, deletedAt: true } });
  if (!tenant || tenant.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = await prisma.profile.findFirst({
    where: { tenantId, role: "owner", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) return NextResponse.json({ error: "This cafe has no active owner account" }, { status: 409 });

  const session = await prisma.$transaction(async (tx) => {
    const s = await tx.impersonationSession.create({
      data: { actorId: guard.user.id, tenantId, asProfileId: owner.id, reason: parsed.data.reason },
    });
    await logActivity(tx, guard.user, {
      tenantId,
      action: "cafe.impersonated",
      target: `profile:${owner.id}`,
      summary: `${guard.user.fullName} logged in as ${owner.fullName} (${tenant.name}) — reason: ${parsed.data.reason}`,
      meta: { asProfileId: owner.id, asProfileName: owner.fullName, sessionId: s.id },
    });
    return s;
  });

  const cookieStore = await cookies();
  cookieStore.set(
    PROFILE_COOKIE,
    signImpersonationToken(owner.id, tenantId, owner.role, guard.user.id),
    impersonationCookieOptions()
  );

  return NextResponse.json({ ok: true, sessionId: session.id, redirectTo: "/owner/orders" });
}
