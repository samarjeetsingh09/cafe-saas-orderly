import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHq } from "@/lib/hq-guard";
import { getTicketHq, addHqMessage } from "@/lib/hq-support";
import { logActivity } from "@/lib/hq-activity";
import { prisma } from "@/lib/db";

const Body = z.object({ body: z.string().trim().min(1).max(2000), internal: z.boolean().default(false) });

/** Reply lands in the cafe's Support tab instantly (same TicketMessage model). Internal notes never do. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("supportInbox");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const ticket = await getTicketHq(id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await addHqMessage(id, parsed.data.body, parsed.data.internal);
  await logActivity(prisma, guard.user, {
    tenantId: ticket.tenantId,
    action: parsed.data.internal ? "ticket.internal_note" : "ticket.replied",
    target: `ticket:${id}`,
    summary: `${guard.user.fullName} ${parsed.data.internal ? "left an internal note on" : "replied to"} ticket ${ticket.code}`,
  });

  return NextResponse.json({ ok: true });
}
