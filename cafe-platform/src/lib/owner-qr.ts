import { prisma } from "@/lib/db";

/** QR tab data (Phase H #4) — real per-table tokens + lifetime scan counts. */
export type QrTableDTO = {
  id: string;
  label: string;
  active: boolean;
  qrToken: string;
  scans: number;
  createdAt: string;
};

export async function getQrTables(tenantId: string): Promise<QrTableDTO[]> {
  const tables = await prisma.cafeTable.findMany({
    where: { tenantId },
    orderBy: { label: "asc" },
    select: { id: true, label: true, active: true, qrToken: true, scans: true, createdAt: true },
  });
  return tables.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));
}
