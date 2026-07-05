import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner, UnauthorizedError } from "@/lib/session";

/** Submit a support query (M6, FR-17). */
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

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) {
    return NextResponse.json({ error: "Write your question (max 1000 letters)." }, { status: 400 });
  }

  const query = await prisma.supportQuery.create({
    data: { cafeId, message },
    select: { id: true, message: true, status: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, query }, { status: 201 });
}
