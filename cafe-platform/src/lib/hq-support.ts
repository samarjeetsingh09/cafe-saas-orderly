import { prisma } from "@/lib/db";
import type { TicketState, TicketPriority } from "@prisma/client";

/**
 * HQ side of the support inbox (HQ-PORTAL-SPEC.md §10) — same
 * Ticket/TicketMessage model Phase H built the cafe side of, plus the triage
 * columns that are HQ-only: assignee, first reply time and resolution time.
 * None of those three are ever sent to the cafe.
 *
 * The SLA is measured on **first response**, not resolution: a cafe that has
 * heard back knows it is being handled, and a resolution clock would punish
 * tickets that are legitimately waiting on the cafe to answer.
 */

/** `met` — replied inside the window. `breached` — no reply and the window is gone. */
export type SlaState = "met" | "late" | "due_soon" | "open" | "breached";

export type HqTicketListRow = {
  id: string;
  code: string;
  tenantId: string;
  tenantName: string;
  topic: string;
  subject: string;
  priority: TicketPriority;
  state: TicketState;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  firstReplyAt: string | null;
  resolvedAt: string | null;
  lastMessageAt: string;
  ageHours: number;
  /** Hours from opening to the first HQ reply; null while unanswered. */
  responseHours: number | null;
  sla: SlaState;
};

function slaFor(createdAt: Date, firstReplyAt: Date | null, slaHours: number): SlaState {
  const deadline = createdAt.getTime() + slaHours * 3_600_000;
  if (firstReplyAt) return firstReplyAt.getTime() <= deadline ? "met" : "late";
  const left = deadline - Date.now();
  if (left < 0) return "breached";
  return left < slaHours * 3_600_000 * 0.25 ? "due_soon" : "open";
}

export async function listTicketsHq(
  filters: { state?: string; tenantId?: string; assigneeId?: string; priority?: string; unassigned?: boolean } = {},
  slaHours = 24
): Promise<HqTicketListRow[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      ...(filters.state ? { state: filters.state as TicketState } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      ...(filters.priority ? { priority: filters.priority as TicketPriority } : {}),
      ...(filters.unassigned ? { assigneeId: null } : filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { name: true } },
      assignee: { select: { id: true, fullName: true } },
      messages: { orderBy: { at: "desc" }, take: 1 },
    },
  });
  return tickets.map((t) => ({
    id: t.id,
    code: t.code,
    tenantId: t.tenantId,
    tenantName: t.tenant.name,
    topic: t.topic,
    subject: t.subject,
    priority: t.priority,
    state: t.state,
    assigneeId: t.assignee?.id ?? null,
    assigneeName: t.assignee?.fullName ?? null,
    createdAt: t.createdAt.toISOString(),
    firstReplyAt: t.firstReplyAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    lastMessageAt: (t.messages[0]?.at ?? t.createdAt).toISOString(),
    ageHours: Math.round((Date.now() - t.createdAt.getTime()) / 3_600_000),
    responseHours: t.firstReplyAt ? Math.round(((t.firstReplyAt.getTime() - t.createdAt.getTime()) / 3_600_000) * 10) / 10 : null,
    // Resolved tickets stop the clock at whatever they achieved; an open
    // ticket keeps counting down.
    sla: t.state === "resolved" && !t.firstReplyAt ? "met" : slaFor(t.createdAt, t.firstReplyAt, slaHours),
  }));
}

export type HqTicketDetail = {
  id: string;
  code: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: string;
  topic: string;
  subject: string;
  priority: TicketPriority;
  state: TicketState;
  assigneeId: string | null;
  openedByName: string | null;
  createdAt: string;
  firstReplyAt: string | null;
  resolvedAt: string | null;
  messages: { id: string; authorKind: "cafe" | "support"; internal: boolean; body: string; at: string }[];
  /** Quick actions in the thread need the cafe's logins to act on. */
  cafeUsers: { id: string; fullName: string; email: string; role: string; active: boolean }[];
};

export async function getTicketHq(id: string): Promise<HqTicketDetail | null> {
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          name: true,
          slug: true,
          status: true,
          profiles: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], select: { id: true, fullName: true, email: true, role: true, active: true } },
        },
      },
      opener: { select: { fullName: true } },
      messages: { orderBy: { at: "asc" } },
    },
  });
  if (!t) return null;
  return {
    id: t.id,
    code: t.code,
    tenantId: t.tenantId,
    tenantName: t.tenant.name,
    tenantSlug: t.tenant.slug,
    tenantStatus: t.tenant.status,
    topic: t.topic,
    subject: t.subject,
    priority: t.priority,
    state: t.state,
    assigneeId: t.assigneeId,
    openedByName: t.opener?.fullName ?? null,
    createdAt: t.createdAt.toISOString(),
    firstReplyAt: t.firstReplyAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    messages: t.messages.map((m) => ({ id: m.id.toString(), authorKind: m.authorKind, internal: m.internal, body: m.body, at: m.at.toISOString() })),
    cafeUsers: t.tenant.profiles,
  };
}

/**
 * Reply into the cafe's thread (visible) or leave an internal note (HQ-only).
 * Replying moves the ticket to `with_us` and — only on the first visible
 * reply — stamps `firstReplyAt`, which is what the SLA is measured against.
 * Internal notes deliberately do not stop the clock: the cafe has not heard
 * anything.
 */
export async function addHqMessage(ticketId: string, body: string, internal: boolean): Promise<void> {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { tenantId: true, firstReplyAt: true } });
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId, tenantId: ticket.tenantId, authorKind: "support", body, internal } }),
    ...(internal
      ? []
      : [
          prisma.ticket.update({
            where: { id: ticketId },
            data: { state: "with_us" as const, ...(ticket.firstReplyAt ? {} : { firstReplyAt: new Date() }) },
          }),
        ]),
  ]);
}

/** Resolving stamps `resolvedAt`; reopening clears it so the metric stays true. */
export async function setTicketStateHq(ticketId: string, state: TicketState): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { state, resolvedAt: state === "resolved" ? new Date() : null },
  });
}

export async function assignTicketHq(ticketId: string, assigneeId: string | null): Promise<void> {
  await prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId } });
}

export async function setTicketPriorityHq(ticketId: string, priority: TicketPriority): Promise<void> {
  await prisma.ticket.update({ where: { id: ticketId }, data: { priority } });
}
