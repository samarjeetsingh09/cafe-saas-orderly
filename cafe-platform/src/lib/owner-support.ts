import { prisma } from "@/lib/db";
import type { TicketPriority, TicketState } from "@prisma/client";

export type TicketMessageDTO = { id: string; authorKind: "cafe" | "support"; body: string; at: string };
export type TicketDTO = {
  id: string;
  code: string;
  topic: string;
  subject: string;
  priority: TicketPriority;
  state: TicketState;
  createdAt: string;
  messages: TicketMessageDTO[];
};

export async function getTickets(tenantId: string): Promise<TicketDTO[]> {
  const tickets = await prisma.ticket.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    // internal:false — HQ-only notes (HQ-PORTAL-SPEC.md §10) must never reach the cafe side.
    include: { messages: { where: { internal: false }, orderBy: { at: "asc" } } },
  });
  return tickets.map((t) => ({
    id: t.id,
    code: t.code,
    topic: t.topic,
    subject: t.subject,
    priority: t.priority,
    state: t.state,
    createdAt: t.createdAt.toISOString(),
    messages: t.messages.map((m) => ({ id: m.id.toString(), authorKind: m.authorKind, body: m.body, at: m.at.toISOString() })),
  }));
}

/**
 * Shared ticket-creation core (Phase H) — used by the Support tab's "New
 * query" (#7), the QR tab's "Request more tables" (#4), and the Plan tab's
 * upgrade/switch button (#6, which never charges — it only ever raises a
 * ticket). `code` isn't unique in the schema, so a low-probability race
 * producing a cosmetic duplicate is an acceptable trade for not needing a
 * sequence table for something this low-stakes.
 */
export async function createTicket(
  tenantId: string,
  profileId: string | null,
  input: { topic: string; subject: string; priority: TicketPriority; body: string }
): Promise<TicketDTO> {
  const count = await prisma.ticket.count({ where: { tenantId } });
  const code = `Q-${2042 + count}`;
  const t = await prisma.ticket.create({
    data: {
      tenantId,
      code,
      topic: input.topic,
      subject: input.subject,
      priority: input.priority,
      state: "open",
      openedBy: profileId,
      messages: { create: { tenantId, authorKind: "cafe", authorId: profileId, body: input.body } },
    },
    include: { messages: { orderBy: { at: "asc" } } },
  });
  return {
    id: t.id,
    code: t.code,
    topic: t.topic,
    subject: t.subject,
    priority: t.priority,
    state: t.state,
    createdAt: t.createdAt.toISOString(),
    messages: t.messages.map((m) => ({ id: m.id.toString(), authorKind: m.authorKind, body: m.body, at: m.at.toISOString() })),
  };
}
