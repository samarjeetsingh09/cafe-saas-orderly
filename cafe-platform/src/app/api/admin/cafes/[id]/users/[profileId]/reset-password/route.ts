import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";
import { hashPassword } from "@/lib/auth";
import { generatePassword } from "@/lib/services/provisionCafe";

/**
 * Reset a cafe staff password (HQ-PORTAL-SPEC.md §1 `resetCafeUserPassword`).
 *
 * The generated password is returned **once, in this response, and never
 * persisted in plaintext** — not in the activity log, not in a column. The log
 * records that a reset happened and by whom; whoever ran it has to hand the
 * password over there and then. Same rule as provisioning's credentials screen.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; profileId: string }> }) {
  const guard = await requireHq("resetCafeUserPassword");
  if ("error" in guard) return guard.error;

  const { id, profileId } = await params;
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, tenantId: true, fullName: true, email: true, role: true, tenant: { select: { name: true } } },
  });
  if (!profile || profile.tenantId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({ where: { id: profileId }, data: { passwordHash } });
    await logActivity(tx, guard.user, {
      tenantId: id,
      action: "cafe_user.password_reset",
      target: `profile:${profileId}`,
      summary: `${guard.user.fullName} reset the password for ${profile.fullName} (${profile.email}) at ${profile.tenant.name}`,
    });
  });

  return NextResponse.json({ ok: true, email: profile.email, fullName: profile.fullName, password });
}
