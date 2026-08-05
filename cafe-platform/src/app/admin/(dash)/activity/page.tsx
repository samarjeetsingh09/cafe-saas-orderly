import Link from "next/link";
import { prisma } from "@/lib/db";
import { listActivity, distinctActions } from "@/lib/hq-activity";
import { ActivityFilterBar } from "@/components/admin/ActivityFilterBar";
import { PageHeader, Card, Empty, dateTime } from "@/components/admin/ui";
import { actionVisual } from "@/components/admin/ui/icons";

export const dynamic = "force-dynamic";

/** "Mon 03 Aug" — the grouping key the eye actually scans a log by. */
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [rows, actions, tenants] = await Promise.all([
    listActivity({ actorEmail: sp.actorEmail, tenantId: sp.tenantId, action: sp.action, from: sp.from, to: sp.to }),
    distinctActions(),
    prisma.tenant.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // A flat table of 200 rows reads as noise; the same rows grouped by day and
  // given the action's own glyph read as a story. The CSV export is still the
  // route for anything that needs to be sorted or pivoted.
  const days: { key: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const key = dayKey(r.at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else days.push({ key, rows: [r] });
  }

  return (
    <>
      <PageHeader title="Activity log" subtitle={`${rows.length} entries — append-only, newest first`} />
      <ActivityFilterBar actions={actions} tenants={tenants} />

      {rows.length === 0 ? (
        <Card>
          <Empty title="No activity matches these filters" action={<Link href="/admin/activity" className="hq-btn">Clear filters</Link>}>
            Try widening the date range.
          </Empty>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {days.map((d) => (
            <Card key={d.key} title={d.key} sub={`${d.rows.length} ${d.rows.length === 1 ? "entry" : "entries"}`}>
              <div className="hq-tl">
                {d.rows.map((r) => {
                  const { Icon, tone } = actionVisual(r.action);
                  return (
                    <div key={r.id} className="hq-tl-row">
                      <div className="hq-tl-ico" data-tone={tone === "neutral" ? undefined : tone}>
                        <Icon />
                      </div>
                      <div className="hq-tl-body">
                        {r.summary}
                        <div className="meta">
                          <span className="mono">{dateTime(r.at)}</span> · <span className="mono">{r.actorEmail}</span> ·{" "}
                          <span className="mono">{r.action}</span>
                          {r.tenantId && (
                            <>
                              {" · "}
                              <Link href={`/admin/cafes/${r.tenantId}`} style={{ color: "inherit" }}>
                                {r.tenantName}
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
