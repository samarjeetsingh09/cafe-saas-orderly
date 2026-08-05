import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

const Body = z.object({ state: z.enum(["open", "resolved"]) });

/** Mark resolved / reopen. Any authenticated staff member — matches the prototype's own thread controls. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;
  const updated = await prisma.ticket.updateMany({ where: { id, tenantId: profile.tenantId }, data: { state: parsed.data.state } });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Query not found" }, { status: 404 });
  }
  await auditIfImpersonated(profile, "ticket.state_changed", `marked ticket ${id} as ${parsed.data.state}`, { ticketId: id });
  return NextResponse.json({ ok: true, state: parsed.data.state });
}
