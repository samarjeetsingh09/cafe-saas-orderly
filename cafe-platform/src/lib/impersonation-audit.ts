import { prisma } from "@/lib/db";
import type { ProfileSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

/**
 * HQ-PORTAL-SPEC.md §8: "Every write during an impersonated session is
 * logged with both identities." Cafe-side mutating routes call this after a
 * successful write; it's a no-op (single boolean check, no query) for every
 * normal staff session, so it's cheap to sprinkle at every mutation site.
 */
export async function auditIfImpersonated(
  profile: Pick<ProfileSession, "id" | "fullName" | "tenantId" | "impersonatedBy">,
  action: string,
  summary: string,
  meta?: Record<string, unknown>
): Promise<void> {
  if (!profile.impersonatedBy) return;
  const actor = await prisma.platformUser.findUnique({ where: { id: profile.impersonatedBy } });
  if (!actor) return;
  await prisma.activityLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      tenantId: profile.tenantId,
      action,
      target: `profile:${profile.id}`,
      summary: `${actor.fullName} (impersonating ${profile.fullName}) ${summary}`,
      meta: (meta as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}
