import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { logActivity } from "@/lib/hq-activity";

const Body = z.object({ action: z.enum(["suspend", "reactivate"]) });

/**
 * Suspend: status='paused' — customer QR pages show a neutral "ordering
 * unavailable" (src/lib/menu.ts checks tenant.status), staff can still log
 * in and read reports. Never surfaces billing trouble to a diner.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("suspendOrDeleteCafe");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
  if (!tenant || tenant.status === "cancelled") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextStatus = parsed.data.action === "suspend" ? "paused" : "active";

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id }, data: { status: nextStatus } });
    await logActivity(tx, guard.user, {
      tenantId: id,
      action: parsed.data.action === "suspend" ? "cafe.suspended" : "cafe.reactivated",
      target: `tenant:${id}`,
      summary: `${guard.user.fullName} ${parsed.data.action === "suspend" ? "suspended" : "reactivated"} ${tenant.name}`,
    });
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
