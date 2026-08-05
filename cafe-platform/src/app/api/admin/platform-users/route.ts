import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";
import { hashPassword } from "@/lib/auth";
import { generatePassword } from "@/lib/services/provisionCafe";

const Body = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  role: z.enum(["super_admin", "ops", "support"]),
});

/** Create an HQ staff account (HQ-PORTAL-SPEC.md §13). super_admin only. */
export async function POST(request: Request) {
  const guard = await requireHq("managePlatformUsers");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const clash = await prisma.platformUser.findUnique({ where: { email }, select: { id: true } });
  if (clash) return NextResponse.json({ error: "That email already has an HQ account" }, { status: 409 });

  // Same rule as cafe staff: generated once, returned once, never persisted
  // in plaintext and never written to the activity log.
  const password = generatePassword();
  const created = await prisma.platformUser.create({
    data: { fullName: parsed.data.fullName, email, role: parsed.data.role, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, fullName: true, role: true },
  });

  await logActivity(prisma, guard.user, {
    action: "platform_user.created",
    target: `platform_user:${created.id}`,
    summary: `${guard.user.fullName} created HQ account ${created.email} (${created.role})`,
  });

  return NextResponse.json({ ...created, password });
}
