import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfile, UnauthorizedError } from "@/lib/session";

/** Minimal active-table list — powers the "Take an order" POS table picker. */
export async function GET() {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }

  const tables = await prisma.cafeTable.findMany({
    where: { tenantId: profile.tenantId, active: true },
    orderBy: { label: "asc" },
    select: { id: true, label: true },
  });
  return NextResponse.json({ tables });
}
