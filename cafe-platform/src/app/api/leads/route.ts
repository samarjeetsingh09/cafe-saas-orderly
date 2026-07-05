import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { allowInWindow } from "@/lib/rate-limit";

/**
 * Marketing-site lead capture (public, unauthenticated). Founder follows
 * up by phone/WhatsApp; leads surface in the admin portal (M10).
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowInWindow(`lead:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: { name?: unknown; phone?: unknown; cafeName?: unknown; city?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const cafeName = typeof body.cafeName === "string" ? body.cafeName.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";

  if (!name || name.length > 80) {
    return NextResponse.json({ error: "Tell us your name." }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }
  if (!cafeName || cafeName.length > 80) {
    return NextResponse.json({ error: "Tell us your cafe's name." }, { status: 400 });
  }

  // Same phone re-submitting within a day = one lead, not spam rows.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.lead.findFirst({
    where: { phone, createdAt: { gte: dayAgo } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.lead.create({
      data: { name, phone, cafeName, city: city || null, message: message || null },
    });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
