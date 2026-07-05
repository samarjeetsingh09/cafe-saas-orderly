import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner, UnauthorizedError } from "@/lib/session";
import { cleanName } from "@/lib/owner-menu";

/** Rename a category (M6). cafeId in the updateMany filter = cross-tenant no-op. */
export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
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

  const { categoryId } = await params;
  const updated = await prisma.category.updateMany({ where: { id: categoryId, cafeId }, data: { name } });
  if (updated.count === 0) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
