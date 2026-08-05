import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { createTicket } from "@/lib/owner-support";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

const Body = z.object({
  topic: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(160),
  priority: z.enum(["normal", "high"]).default("normal"),
  body: z.string().trim().min(1).max(2000),
});

/** Any authenticated staff member can raise a ticket — no capability gate, matches the prototype. */
export async function POST(request: Request) {
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

  const ticket = await createTicket(profile.tenantId, profile.id, parsed.data);
  await auditIfImpersonated(profile, "ticket.created", `raised ticket "${ticket.subject}"`, { ticketId: ticket.id });
  return NextResponse.json({ ticket }, { status: 201 });
}
