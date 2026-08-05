import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

const Body = z.object({ body: z.string().trim().min(1).max(2000) });

/** Adding a reply reopens the ticket, matching the prototype (a reply always sets `state: 'open'`). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId: profile.tenantId } });
  if (!ticket) {
    return NextResponse.json({ error: "Query not found" }, { status: 404 });
  }

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.ticketMessage.create({
      data: { tenantId: profile.tenantId, ticketId: id, authorKind: "cafe", authorId: profile.id, body: parsed.data.body },
    });
    await tx.ticket.update({ where: { id }, data: { state: "open" } });
    return m;
  });

  await auditIfImpersonated(profile, "ticket.replied", `replied to ticket ${id}`, { ticketId: id });
  return NextResponse.json({ message: { id: message.id.toString(), authorKind: message.authorKind, body: message.body, at: message.at.toISOString() } });
}
