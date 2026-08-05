import Link from "next/link";
import { getCafeHealth, getPlatformHealth, HEALTH_META, formatBytes, type HealthStatus } from "@/lib/hq-health";
import { PageHeader, Card, StatStrip, Stat, Badge, TableWrap, Empty, ago, shortDate } from "@/components/admin/ui";
import { BarRow } from "@/components/admin/BarRow";

export const dynamic = "force-dynamic";

const ORDER: HealthStatus[] = ["down", "at_risk", "quiet", "healthy"];

export default async function Page({ searchParams }: { searchParams: Promise<{ health?: string }> }) {
  const [{ health: filter }, rows, platform] = await Promise.all([searchParams, getCafeHealth(), getPlatformHealth()]);

  const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.health]: (acc[r.health] ?? 0) + 1 }), {});
  const shown = filter ? rows.filter((r) => r.health === filter) : rows;
  const sorted = [...shown].sort((a, b) => ORDER.indexOf(a.health) - ORDER.indexOf(b.health) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Monitoring"
        subtitle="Platform figures come straight from Postgres. Per-cafe health is computed live, not cached behind a job."
      />

      <StatStrip>
        <Stat label="Database size" value={formatBytes(platform.dbSizeBytes)} />
        <Stat label="DB connections" value={platform.dbConnections} />
        <Stat label="Cafes" value={platform.tenantCount} />
        <Stat label="Orders (all time)" value={platform.orderCount.toLocaleString("en-IN")} />
        <Stat label="Orders 24h" value={platform.ordersLast24h} />
        <Stat label="Down" value={counts.down ?? 0} tone={counts.down ? "danger" : "ok"} />
        <Stat label="At risk" value={counts.at_risk ?? 0} tone={counts.at_risk ? "warn" : "ok"} />
        <Stat label="Healthy" value={counts.healthy ?? 0} tone="ok" />
      </StatStrip>

      <Card
        title="Cafe health"
        sub={filter ? `Filtered to ${HEALTH_META[filter as HealthStatus]?.label ?? filter}` : `${rows.length} cafes`}
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/admin/monitoring" className="hq-btn" data-size="sm" data-variant={filter ? "ghost" : "primary"}>
              All
            </Link>
            {ORDER.map((h) => (
              <Link
                key={h}
                href={`/admin/monitoring?health=${h}`}
                className="hq-btn"
                data-size="sm"
                data-variant={filter === h ? "primary" : "ghost"}
              >
                {HEALTH_META[h].label} {counts[h] ? `(${counts[h]})` : ""}
              </Link>
            ))}
          </div>
        }
        flush
      >
        {sorted.length === 0 ? (
          <Empty title="Nothing in this bucket">No cafe currently has that status.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Cafe</th>
                <th>Health</th>
                <th>Plan</th>
                <th>7-day trend</th>
                <th className="r">Today</th>
                <th className="r">7 days</th>
                <th className="r">Last order</th>
                <th className="r">Staff</th>
                <th className="r">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const meta = HEALTH_META[r.health];
                const peak = Math.max(1, ...r.trend);
                return (
                  <tr key={r.tenantId} data-rail={meta.tone === "neutral" ? undefined : meta.tone}>
                    <td>
                      <Link href={`/admin/cafes/${r.tenantId}`} className="name">
                        {r.name}
                      </Link>
                      <span className="sub mono">{r.slug}</span>
                    </td>
                    <td>
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                    </td>
                    <td>{r.planName ?? "—"}</td>
                    <td style={{ width: 108 }}>
                      <div style={{ height: 26 }}>
                        <BarRow bars={r.trend.map((v, i) => ({ value: v, max: peak, label: `Day ${i + 1}: ${v}` }))} />
                      </div>
                    </td>
                    <td className="r num">{r.ordersToday}</td>
                    <td className="r num">{r.orders7d}</td>
                    <td className="r num" title={r.lastOrderAt ? shortDate(r.lastOrderAt) : "No orders yet"}>
                      {r.lastOrderAt ? ago(r.lastOrderAt) : "never"}
                    </td>
                    <td className="r num">{r.staffCount}</td>
                    <td className="r num">{r.openTickets || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div style={{ height: 14 }} />

      <Card title="Largest tables" sub="Row estimates from pg_stat_user_tables">
        <TableWrap>
          <thead>
            <tr>
              <th>Table</th>
              <th className="r">Live rows</th>
            </tr>
          </thead>
          <tbody>
            {platform.slowestTableRows.map((t) => (
              <tr key={t.table}>
                <td className="mono">{t.table}</td>
                <td className="r num">{t.rows.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
