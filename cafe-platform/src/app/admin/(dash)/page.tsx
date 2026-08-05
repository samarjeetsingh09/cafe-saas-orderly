import Link from "next/link";
import { getDashboardCards, getRecentActivity, getOrdersPerDay, getCafesPerMonth } from "@/lib/hq-dashboard";
import { getCafeHealth, HEALTH_META } from "@/lib/hq-health";
import { PageHeader, Card, StatStrip, Stat, Badge, Empty, TableWrap, compactRupees, rupees, dateTime, ago } from "@/components/admin/ui";
import { actionVisual } from "@/components/admin/ui/icons";
import { BarRow } from "@/components/admin/BarRow";

export const dynamic = "force-dynamic";

/**
 * The dashboard opens with the **attention queue**, not the KPI row — the
 * deliberate departure from the standard admin layout. HQ-PORTAL-SPEC.md §4
 * makes the case itself: "A cafe that stopped ordering is churning next
 * month; surface it before they call." Numbers you glance at are demoted to
 * a single compact strip; the list you act on gets the top of the page.
 */
export default async function Page() {
  const [cards, activity, health, ordersPerDay, cafesPerMonth] = await Promise.all([
    getDashboardCards(),
    getRecentActivity(12),
    getCafeHealth(),
    getOrdersPerDay(30),
    getCafesPerMonth(12),
  ]);

  const needsAttention = health
    .filter((h) => h.health === "at_risk" || h.health === "down" || h.openTickets > 0)
    .sort((a, b) => {
      const rank = { down: 0, at_risk: 1, quiet: 2, healthy: 3 } as const;
      return rank[a.health] - rank[b.health] || b.openTickets - a.openTickets;
    });

  const peakOrders = Math.max(1, ...ordersPerDay.map((d) => d.orders));
  const peakCafes = Math.max(1, ...cafesPerMonth.map((d) => d.count));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="What needs a decision today, then the numbers behind it.">
        <Link href="/admin/cafes/new" className="hq-btn" data-variant="accent">
          Provision cafe
        </Link>
      </PageHeader>

      <Card
        title="Needs attention"
        sub={needsAttention.length ? `${needsAttention.length} cafe${needsAttention.length === 1 ? "" : "s"}` : undefined}
        action={
          <Link href="/admin/monitoring" className="hq-btn" data-size="sm">
            All health
          </Link>
        }
        flush
      >
        {needsAttention.length === 0 ? (
          <Empty title="Everything's steady">Every active cafe ordered recently and no tickets are open.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Cafe</th>
                <th>Status</th>
                <th>Why</th>
                <th className="r">Orders today</th>
                <th className="r">Last order</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {needsAttention.slice(0, 8).map((h) => {
                const meta = HEALTH_META[h.health];
                return (
                  <tr key={h.tenantId} data-rail={meta.tone === "neutral" ? undefined : meta.tone}>
                    <td>
                      <Link href={`/admin/cafes/${h.tenantId}`} className="name">
                        {h.name}
                      </Link>
                      <span className="sub mono">{h.slug}</span>
                    </td>
                    <td>
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                    </td>
                    <td>
                      {h.health === "down"
                        ? "No orders ever — onboarding stalled"
                        : h.health === "at_risk"
                          ? `Quiet ${h.daysSinceOrder} days`
                          : h.openTickets > 0
                            ? `${h.openTickets} open ticket${h.openTickets === 1 ? "" : "s"}`
                            : "—"}
                    </td>
                    <td className="r num">{h.ordersToday}</td>
                    <td className="r num">{h.lastOrderAt ? ago(h.lastOrderAt) : "never"}</td>
                    <td className="r">
                      <Link href={`/admin/cafes/${h.tenantId}`} className="hq-btn" data-size="sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div style={{ height: 16 }} />

      <StatStrip>
        <Stat label="Cafes" value={cards.totalCafes} delta={`${cards.active} active · ${cards.trial} trial`} />
        <Stat label="Paused" value={cards.paused} tone={cards.paused > 0 ? "warn" : "neutral"} />
        <Stat label="Orders today" value={cards.ordersToday} />
        <Stat label="Revenue today" value={compactRupees(cards.revenueTodayPaise)} />
        <Stat label="MRR" value={compactRupees(cards.mrrPaise)} />
        <Stat label="Expiring 14d" value={cards.expiringSoon} tone={cards.expiringSoon > 0 ? "warn" : "neutral"} />
        <Stat label="Open tickets" value={cards.openTickets} tone={cards.openTickets > 0 ? "warn" : "neutral"} />
        <Stat label="Zero orders" value={cards.zeroOrderCafes} tone={cards.zeroOrderCafes > 0 ? "danger" : "ok"} />
      </StatStrip>

      <div className="hq-grid2">
        <Card title="Orders per day" sub="Last 30 days, platform-wide">
          <BarRow
            bars={ordersPerDay.map((d) => ({
              value: d.orders,
              max: peakOrders,
              label: `${new Date(d.dateKey).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${d.orders} orders`,
            }))}
          />
          <div className="hq-sep" />
          <dl className="hq-dl">
            <div>
              <dt>Busiest day</dt>
              <dd className="num">{peakOrders} orders</dd>
            </div>
            <div>
              <dt>30-day total</dt>
              <dd className="num">{ordersPerDay.reduce((s, d) => s + d.orders, 0)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="New cafes" sub="Last 12 months">
          <BarRow
            bars={cafesPerMonth.map((d) => ({ value: d.count, max: peakCafes, label: `${d.label}: ${d.count} onboarded` }))}
          />
          <div className="hq-sep" />
          <dl className="hq-dl">
            <div>
              <dt>Best month</dt>
              <dd className="num">{peakCafes} cafes</dd>
            </div>
            <div>
              <dt>Revenue today</dt>
              <dd className="num">{rupees(cards.revenueTodayPaise)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div style={{ height: 14 }} />

      <Card
        title="Recent activity"
        action={
          <Link href="/admin/activity" className="hq-btn" data-size="sm">
            Full log
          </Link>
        }
      >
        {activity.length === 0 ? (
          <Empty title="No activity yet">Provisioning a cafe or replying to a ticket will show up here.</Empty>
        ) : (
          <div className="hq-tl">
            {activity.map((a) => {
              const { Icon, tone } = actionVisual(a.action);
              return (
                <div className="hq-tl-row" key={a.id}>
                  <span className="hq-tl-ico" data-tone={tone === "neutral" ? undefined : tone}>
                    <Icon />
                  </span>
                  <div className="hq-tl-body">
                    {a.summary}
                    <div className="meta">
                      <span className="mono">{a.actorEmail}</span>
                      {a.tenantName && ` · ${a.tenantName}`} · {dateTime(a.at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
