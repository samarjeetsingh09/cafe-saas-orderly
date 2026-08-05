import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireHq } from "@/lib/hq-guard";
import { isValidCafeSlug } from "@/lib/slugs";
import { provisionCafe } from "@/lib/services/provisionCafe";

const Body = z.object({
  idempotencyKey: z.string().min(8),
  cafe: z.object({
    name: z.string().trim().min(1).max(80),
    slug: z.string().trim().toLowerCase(),
    ownerName: z.string().trim().min(1).max(80),
    ownerEmail: z.string().trim().toLowerCase().email(),
    ownerPhone: z.string().trim().min(6).max(20),
    address: z.string().trim().max(200).optional(),
    timezone: z.string().default("Asia/Kolkata"),
    gstNumber: z.string().trim().max(30).optional(),
    gstPercent: z.number().min(0).max(28).default(5),
  }),
  branding: z.object({
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    theme: z.record(z.string(), z.string()),
  }),
  subscription: z.object({
    planId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    setupFeePaise: z.number().int().min(0).optional(),
    trial: z.boolean(),
    trialEndsAt: z.string().optional(),
  }),
  payments: z.object({
    acceptCash: z.boolean(),
    acceptCounterUpi: z.boolean(),
    acceptOnline: z.boolean(),
    gateway: z.string().optional(),
    keyId: z.string().optional(),
    keySecret: z.string().optional(),
    webhookSecret: z.string().optional(),
    enabled: z.boolean(),
  }),
  tables: z.object({ count: z.number().int().min(1).max(200), startingNumber: z.number().int().min(1).default(1) }),
  splitKitchen: z.boolean(),
  templateId: z.string().optional(),
});

export async function POST(request: Request) {
  const guard = await requireHq("provisionCafe");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  if (!isValidCafeSlug(input.cafe.slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const existing = await prisma.tenant.findUnique({ where: { slug: input.cafe.slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "That slug is already taken" }, { status: 409 });
  }
  const plan = await prisma.plan.findUnique({ where: { id: input.subscription.planId } });
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  try {
    const result = await provisionCafe(input, guard.user);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error("provisionCafe failed", e);
    return NextResponse.json({ error: "Provisioning failed — no cafe was created" }, { status: 500 });
  }
}
