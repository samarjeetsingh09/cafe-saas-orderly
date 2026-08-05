import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHq } from "@/lib/hq-guard";
import { getTicketHq, setTicketStateHq, assignTicketHq, setTicketPriorityHq } from "@/lib/hq-support";
import { logActivity } from "@/lib/hq-activity";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("supportInbox");
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const ticket = await getTicketHq(id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

const Body = z.object({
  state: z.enum(["open", "with_us", "resolved"]).optional(),
  /** `null` unassigns — a `<select>` cannot send `undefined`. */
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["normal", "high"]).optional(),
});

/** Triage: state, assignee and priority (HQ-PORTAL-SPEC.md §10). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHq("supportInbox");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  const ticket = await getTicketHq(id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { state, assigneeId, priority } = parsed.data;
  const summaries: string[] = [];

  if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
    let name = "nobody";
    if (assigneeId) {
      const assignee = await prisma.platformUser.findUnique({ where: { id: assigneeId }, select: { fullName: true, active: true } });
      // A deactivated account must not be able to hold a queue — that is how
      // tickets go quiet after someone leaves.
      if (!assignee || !assignee.active) return NextResponse.json({ error: "That HQ user cannot take tickets" }, { status: 400 });
      name = assignee.fullName;
    }
    await assignTicketHq(id, assigneeId);
    summaries.push(`assigned ticket ${ticket.code} to ${name}`);
  }

  if (priority && priority !== ticket.priority) {
    await setTicketPriorityHq(id, priority);
    summaries.push(`set ticket ${ticket.code} priority to ${priority}`);
  }

  if (state && state !== ticket.state) {
    await setTicketStateHq(id, state);
    summaries.push(`marked ticket ${ticket.code} as ${state}`);
  }

  if (summaries.length === 0) return NextResponse.json({ ok: true, unchanged: true });

  await logActivity(prisma, guard.user, {
    tenantId: ticket.tenantId,
    action: state ? "ticket.state_changed" : assigneeId !== undefined ? "ticket.assigned" : "ticket.priority_changed",
    target: `ticket:${id}`,
    summary: `${guard.user.fullName} ${summaries.join(", ")}`,
  });

  return NextResponse.json({ ok: true });
}
