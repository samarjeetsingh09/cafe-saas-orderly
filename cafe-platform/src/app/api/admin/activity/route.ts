import { NextResponse } from "next/server";
import { requireHq } from "@/lib/hq-guard";
import { listActivity } from "@/lib/hq-activity";

/** CSV export for the activity log filter bar (`?format=csv`), same filters as the page. */
export async function GET(request: Request) {
  const guard = await requireHq("readActivity");
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const filters = {
    actorEmail: url.searchParams.get("actorEmail") || undefined,
    tenantId: url.searchParams.get("tenantId") || undefined,
    action: url.searchParams.get("action") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  };
  const rows = await listActivity(filters, 2000);

  if (url.searchParams.get("format") === "csv") {
    const header = "at,actorEmail,tenantName,action,summary\n";
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = header + rows.map((r) => [r.at, r.actorEmail, r.tenantName ?? "", r.action, r.summary].map((v) => esc(String(v))).join(",")).join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=activity-log.csv" } });
  }

  return NextResponse.json({ rows });
}
