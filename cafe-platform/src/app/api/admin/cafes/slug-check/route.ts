import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { isValidCafeSlug } from "@/lib/slugs";

/** Live uniqueness check for the wizard's Step 1 slug field. */
export async function GET(request: Request) {
  const guard = await requireHq("provisionCafe");
  if ("error" in guard) return guard.error;

  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (!isValidCafeSlug(slug)) {
    return NextResponse.json({ available: false, reason: "Slug must be 3-40 lowercase letters/numbers/hyphens and not a reserved word." });
  }
  const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return NextResponse.json({ available: !existing });
}
