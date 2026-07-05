import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner, UnauthorizedError } from "@/lib/session";
import { cleanDescription, cleanName, cleanPhotoUrl, cleanPrice, serializeItem } from "@/lib/owner-menu";
import type { Prisma } from "@prisma/client";

/**
 * Edit a dish (M6): name / price / description / photo link / veg mark /
 * sold-out toggle (isAvailable, FR-27). Partial updates — only the fields
 * present in the body change. cafeId in the filter = cross-tenant no-op.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  let cafeId: string;
  try {
    cafeId = (await requireOwner()).id;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Owner session required" }, { status: 401 });
    }
    throw e;
  }

  let body: {
    name?: unknown;
    description?: unknown;
    price?: unknown;
    isVeg?: unknown;
    isAvailable?: unknown;
    photoUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Prisma.MenuItemUpdateManyMutationInput = {};
  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (!name) return NextResponse.json({ error: "Give the dish a name (max 80 letters)." }, { status: 400 });
    data.name = name;
  }
  if (body.price !== undefined) {
    const price = cleanPrice(body.price);
    if (price === null) return NextResponse.json({ error: "Price must be between ₹1 and ₹1,00,000." }, { status: 400 });
    data.price = price;
  }
  if (body.description !== undefined) {
    const description = cleanDescription(body.description);
    if (description === "invalid") return NextResponse.json({ error: "Description is too long (max 300 letters)." }, { status: 400 });
    data.description = description;
  }
  if (body.photoUrl !== undefined) {
    const photoUrl = cleanPhotoUrl(body.photoUrl);
    if (photoUrl === "invalid") return NextResponse.json({ error: "Photo link must be a full http(s) address." }, { status: 400 });
    data.photoUrl = photoUrl;
  }
  if (body.isVeg !== undefined) {
    if (typeof body.isVeg !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    data.isVeg = body.isVeg;
  }
  if (body.isAvailable !== undefined) {
    if (typeof body.isAvailable !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    data.isAvailable = body.isAvailable;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { itemId } = await params;
  const updated = await prisma.menuItem.updateMany({ where: { id: itemId, cafeId }, data });
  if (updated.count === 0) return NextResponse.json({ error: "Dish not found" }, { status: 404 });

  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  return NextResponse.json({ ok: true, item: item ? serializeItem(item) : null });
}
