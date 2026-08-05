import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/session";
import { logActivity } from "@/lib/hq-activity";
import { PROFILE_COOKIE } from "@/lib/auth";

/** Exit an impersonation session — closes the ImpersonationSession row, clears the cookie, logs it. */
export async function POST() {
  const profile = await getProfile();
  const cookieStore = await cookies();

  if (!profile || !profile.impersonatedBy) {
    cookieStore.delete(PROFILE_COOKIE);
    return NextResponse.json({ ok: true });
  }

  const actor = await prisma.platformUser.findUnique({ where: { id: profile.impersonatedBy } });

  await prisma.$transaction(async (tx) => {
    const session = await tx.impersonationSession.findFirst({
      where: { actorId: profile.impersonatedBy!, tenantId: profile.tenantId, asProfileId: profile.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (session) await tx.impersonationSession.update({ where: { id: session.id }, data: { endedAt: new Date() } });
    if (actor) {
      await logActivity(tx, actor, {
        tenantId: profile.tenantId,
        action: "cafe.impersonation_ended",
        target: `profile:${profile.id}`,
        summary: `${actor.fullName} exited impersonation of ${profile.fullName} (${profile.tenant.name})`,
      });
    }
  });

  cookieStore.delete(PROFILE_COOKIE);
  return NextResponse.json({ ok: true, tenantId: profile.tenantId });
}
