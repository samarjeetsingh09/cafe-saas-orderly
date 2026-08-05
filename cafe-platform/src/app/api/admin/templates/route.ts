import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHq } from "@/lib/hq-guard";
import { listTemplates, createTemplate } from "@/lib/hq-templates";

const Variant = z.object({ label: z.string().min(1), pricePaise: z.number().int().min(0) });
const Item = z.object({ name: z.string().min(1), description: z.string().optional(), variants: z.array(Variant).min(1) });
const Category = z.object({ name: z.string().min(1), isVeg: z.boolean(), items: z.array(Item) });
const Body = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
  theme: z.record(z.string(), z.string()),
  categories: z.array(Category),
  settings: z.object({ gstPercent: z.number().min(0).max(28), splitKitchen: z.boolean(), prepMinutes: z.number().int().min(1).max(60) }),
});

export async function GET() {
  const guard = await requireHq("viewDashboard");
  if ("error" in guard) return guard.error;
  return NextResponse.json({ templates: await listTemplates() });
}

export async function POST(request: Request) {
  const guard = await requireHq("manageTemplates");
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });

  const template = await createTemplate(parsed.data);
  return NextResponse.json({ template }, { status: 201 });
}
