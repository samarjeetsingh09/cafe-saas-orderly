import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner, UnauthorizedError } from "@/lib/session";
import { cleanName } from "@/lib/owner-menu";

/** Add a menu category (M6, FR-16). */
export async function POST(request: Request) {
  let cafeId: string;
  try {
    cafeId = (await requireOwner()).id;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Owner session required" }, { status: 401 });
    }
    throw e;
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const name = cleanName(body.name);
  if (!name) return NextResponse.json({ error: "Give the category a name (max 80 letters)." }, { status: 400 });

  const last = await prisma.category.findFirst({
    where: { cafeId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const category = await prisma.category.create({
    data: { cafeId, name, displayOrder: (last?.displayOrder ?? 0) + 1 },
    select: { id: true, name: true },
  });
  return NextResponse.json({ ok: true, category: { ...category, items: [] } }, { status: 201 });
}
