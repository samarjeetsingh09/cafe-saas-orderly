import { prisma } from "@/lib/db";
import type { PlatformUser, Prisma } from "@prisma/client";

/**
 * Append-only activity log writer (HQ-PORTAL-SPEC.md §11) — no update/delete
 * route exists anywhere for this model. Always call inside the same
 * transaction as the action it records, so a rolled-back mutation can never
 * leave a log entry claiming it happened.
 */
export async function logActivity(
  db: Prisma.TransactionClient | typeof prisma,
  actor: PlatformUser,
  entry: { tenantId?: string | null; action: string; target?: string | null; summary: string; meta?: Record<string, unknown> | null }
) {
  await db.activityLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      tenantId: entry.tenantId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      summary: entry.summary,
      meta: (entry.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export type ActivityFilters = { actorEmail?: string; tenantId?: string; action?: string; from?: string; to?: string };

export async function listActivity(filters: ActivityFilters, limit = 200) {
  const rows = await prisma.activityLog.findMany({
    where: {
      ...(filters.actorEmail ? { actorEmail: { contains: filters.actorEmail, mode: "insensitive" } } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from || filters.to
        ? { at: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {}),
    },
    orderBy: { at: "desc" },
    take: limit,
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  });
  return rows.map((r) => ({
    id: r.id.toString(),
    actorEmail: r.actorEmail,
    tenantId: r.tenant?.id ?? null,
    tenantName: r.tenant?.name ?? null,
    tenantSlug: r.tenant?.slug ?? null,
    action: r.action,
    target: r.target,
    summary: r.summary,
    meta: r.meta,
    at: r.at.toISOString(),
  }));
}

export async function distinctActions(): Promise<string[]> {
  const rows = await prisma.activityLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}
