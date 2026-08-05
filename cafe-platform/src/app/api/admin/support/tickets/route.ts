import { NextResponse } from "next/server";
import { requireHq } from "@/lib/hq-guard";
import { listTicketsHq } from "@/lib/hq-support";
import { getPlatformSettings } from "@/lib/hq-settings";

export async function GET(request: Request) {
  const guard = await requireHq("supportInbox");
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const settings = await getPlatformSettings();
  const rows = await listTicketsHq(
    {
      state: url.searchParams.get("state") ?? undefined,
      tenantId: url.searchParams.get("tenantId") ?? undefined,
      assigneeId: url.searchParams.get("assigneeId") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      unassigned: url.searchParams.get("unassigned") === "1",
    },
    settings.supportSlaHours
  );
  return NextResponse.json({ tickets: rows, slaHours: settings.supportSlaHours });
}
