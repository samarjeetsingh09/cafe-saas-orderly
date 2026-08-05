import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";
import { hashPassword } from "@/lib/auth";
import { generatePassword } from "@/lib/services/provisionCafe";

const Body = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["super_admin", "ops", "support"]).optional(),
  active: z.boolean().optional(),
  resetPassword: z.literal(true).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("managePlatformUsers");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const target = await prisma.platformUser.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fullName, role, active, resetPassword } = parsed.data;

  // You cannot lock yourself out, and you cannot remove the last super admin.
  // Both are recoverable only by direct database access, which is exactly the
  // 3am situation this console exists to avoid.
  if (target.id === guard.user.id && (active === false || (role && role !== "super_admin"))) {
    return NextResponse.json({ error: "You cannot deactivate or demote your own account" }, { status: 400 });
  }
  if (target.role === "super_admin" && (active === false || (role && role !== "super_admin"))) {
    const others = await prisma.platformUser.count({ where: { role: "super_admin", active: true, id: { not: id } } });
    if (others === 0) return NextResponse.json({ error: "This is the last active super admin" }, { status: 400 });
  }

  let password: string | undefined;
  const data: { fullName?: string; role?: "super_admin" | "ops" | "support"; active?: boolean; passwordHash?: string } = {};
  if (fullName) data.fullName = fullName;
  if (role) data.role = role;
  if (active !== undefined) data.active = active;
  if (resetPassword) {
    password = generatePassword();
    data.passwordHash = await hashPassword(password);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true, unchanged: true });

  const changes = [
    fullName && fullName !== target.fullName ? `name → ${fullName}` : null,
    role && role !== target.role ? `role ${target.role} → ${role}` : null,
    active !== undefined && active !== target.active ? (active ? "reactivated" : "deactivated") : null,
    resetPassword ? "password reset" : null,
  ].filter(Boolean) as string[];

  await prisma.$transaction(async (tx) => {
    await tx.platformUser.update({ where: { id }, data });
    await logActivity(tx, guard.user, {
      action: "platform_user.updated",
      target: `platform_user:${id}`,
      summary: `${guard.user.fullName} updated HQ account ${target.email} — ${changes.join(", ") || "no field change"}`,
      meta: { changes },
    });
  });

  return NextResponse.json({ ok: true, email: target.email, fullName: target.fullName, password });
}
