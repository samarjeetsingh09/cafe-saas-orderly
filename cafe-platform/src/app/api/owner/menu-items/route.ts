import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner, UnauthorizedError } from "@/lib/session";
import { cleanDescription, cleanName, cleanPhotoUrl, cleanPrice, serializeItem } from "@/lib/owner-menu";

/** Add a dish (M6, FR-16). Category ownership is verified before the insert. */
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

  let body: {
    categoryId?: unknown;
    name?: unknown;
    description?: unknown;
    price?: unknown;
    isVeg?: unknown;
    photoUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = cleanName(body.name);
  if (!name) return NextResponse.json({ error: "Give the dish a name (max 80 letters)." }, { status: 400 });
  const price = cleanPrice(body.price);
  if (price === null) return NextResponse.json({ error: "Price must be between ₹1 and ₹1,00,000." }, { status: 400 });
  const description = cleanDescription(body.description);
  if (description === "invalid") return NextResponse.json({ error: "Description is too long (max 300 letters)." }, { status: 400 });
  const photoUrl = cleanPhotoUrl(body.photoUrl);
  if (photoUrl === "invalid") return NextResponse.json({ error: "Photo link must be a full http(s) address." }, { status: 400 });
  if (typeof body.categoryId !== "string" || !body.categoryId) {
    return NextResponse.json({ error: "Pick a category." }, { status: 400 });
  }

  // Ownership check: the category must belong to this cafe.
  const category = await prisma.category.findFirst({
    where: { id: body.categoryId, cafeId },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const last = await prisma.menuItem.findFirst({
    where: { categoryId: category.id },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const item = await prisma.menuItem.create({
    data: {
      cafeId,
      categoryId: category.id,
      name,
      description,
      price,
      photoUrl,
      isVeg: body.isVeg !== false, // default veg, explicit false = non-veg
      displayOrder: (last?.displayOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ ok: true, item: serializeItem(item) }, { status: 201 });
}
