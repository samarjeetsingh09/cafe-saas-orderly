import Link from "next/link";
import { notFound } from "next/navigation";
import { getCafeDetail } from "@/lib/hq-cafes";
import { getPlatformUser } from "@/lib/session";
import { canHq } from "@/lib/hq-permissions";
import { listActivity } from "@/lib/hq-activity";
import { CafeActions } from "@/components/admin/CafeActions";
import { SaveAsTemplateButton } from "@/components/admin/SaveAsTemplateButton";
import { StaffTable } from "@/components/admin/StaffTable";
import { PageHeader, Card, StatStrip, Stat, Badge, Empty, STATUS_TONE, rupees, shortDate, dateTime, ago } from "@/components/admin/ui";
import { actionVisual } from "@/components/admin/ui/icons";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;
  const [cafe, user] = await Promise.all([getCafeDetail(cafeId), getPlatformUser()]);
  if (!cafe) notFound();
  const role = user!.role;
  const activity = await listActivity({ tenantId: cafe.id }, 12);

  const daysToRenewal = cafe.subscription?.daysLeft ?? null;

  return (
    <>
      <PageHeader
        title={cafe.name}
        subtitle={`${cafe.slug}${cafe.version ? ` · v${cafe.version}` : ""} · created ${shortDate(cafe.createdAt)}`}
        back={{ href: "/admin/cafes", label: "All cafes" }}
      >
        <Badge tone={STATUS_TONE[cafe.status] ?? "neutral"} dot>
          {cafe.status}
        </Badge>
        <CafeActions
          tenantId={cafe.id}
          tenantSlug={cafe.slug}
          tenantName={cafe.name}
          status={cafe.status}
          canBilling={canHq(role, "suspendOrDeleteCafe")}
          canImpersonate={canHq(role, "impersonate")}
          canEdit={canHq(role, "editBranding")}
          size="md"
        />
        {canHq(role, "manageTemplates") && <SaveAsTemplateButton tenantId={cafe.id} defaultName={cafe.name} />}
      </PageHeader>

      <StatStrip>
        <Stat label="Orders today" value={cafe.ordersToday} tone={cafe.ordersToday === 0 && cafe.status === "active" ? "warn" : "neutral"} />
        <Stat label="Orders 30d" value={cafe.orders30d} />
        <Stat label="Revenue 30d" value={rupees(cafe.revenue30dPaise)} />
        <Stat label="Last order" value={cafe.lastOrderAt ? ago(cafe.lastOrderAt) : "never"} tone={cafe.lastOrderAt ? "neutral" : "danger"} />
        <Stat label="Tables" value={cafe.tableCount} />
        <Stat label="Menu items" value={cafe.menuItemCount} />
        <Stat label="Open tickets" value={cafe.openTicketCount} tone={cafe.openTicketCount > 0 ? "warn" : "neutral"} />
      </StatStrip>

      <div className="hq-grid2">
        <Card title="Cafe info">
          <dl className="hq-dl">
            <Row label="Phone">{cafe.phone ? <span className="mono">{cafe.phone}</span> : "—"}</Row>
            <Row label="Address">{cafe.address ?? "—"}</Row>
            <Row label="GST">{cafe.gstNumber ? <span className="mono">{cafe.gstNumber}</span> : "—"} · {cafe.gstPercent}%</Row>
            <Row label="Kitchen">{cafe.splitKitchen ? "Split (veg / non-veg)" : "Single station"}</Row>
            <Row label="Timezone">{cafe.timezone}</Row>
            <Row label="Menu">
              <span className="mono">
                {cafe.categoryCount} categories · {cafe.menuItemCount} items
              </span>
            </Row>
            {cafe.trialEndsAt && <Row label="Trial ends">
              <span className="mono">{shortDate(cafe.trialEndsAt)}</span>
            </Row>}
            {cafe.goLiveAt && <Row label="Went live">
              <span className="mono">{shortDate(cafe.goLiveAt)}</span>
            </Row>}
            <Row label="Customer link">
              <span className="mono">/{cafe.slug}</span>
            </Row>
          </dl>
        </Card>

        <Card
          title="Subscription"
          action={
            canHq(role, "changeSubscription") ? (
              <Link href="/admin/billing" className="hq-btn" data-size="sm">
                Billing
              </Link>
            ) : undefined
          }
        >
          {cafe.subscription ? (
            <dl className="hq-dl">
              <Row label="Plan">{cafe.subscription.planName}</Row>
              <Row label="Price">
                <span className="mono">{rupees(cafe.subscription.pricePaise)}/mo</span>
              </Row>
              <Row label="Status">
                <Badge tone={cafe.subscription.status === "active" ? "ok" : cafe.subscription.status === "past_due" ? "danger" : cafe.subscription.status === "trialing" ? "info" : "neutral"}>
                  {cafe.subscription.status}
                </Badge>
              </Row>
              <Row label="Current period">
                <span className="mono">
                  {shortDate(cafe.subscription.currentStart)} → {shortDate(cafe.subscription.currentEnd)}
                </span>
              </Row>
              <Row label={cafe.subscription.cancelAtEnd ? "Ends in" : "Renews in"}>
                <span className="mono" style={{ color: daysToRenewal !== null && daysToRenewal <= 14 ? "var(--hq-warn)" : undefined }}>
                  {daysToRenewal !== null && daysToRenewal >= 0 ? `${daysToRenewal}d` : "overdue"}
                </span>
              </Row>
            </dl>
          ) : (
            <Empty title="No subscription on file">This cafe has never been put on a plan.</Empty>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card title={`Staff (${cafe.users.length})`} sub="Reset a password or switch an account off" flush>
          <StaffTable
            tenantId={cafe.id}
            canManage={canHq(role, "resetCafeUserPassword")}
            users={cafe.users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
          />
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card
          title="Recent activity"
          sub="This cafe only"
          action={
            <Link href={`/admin/activity?tenantId=${cafe.id}`} className="hq-btn" data-size="sm">
              Full log
            </Link>
          }
        >
          {activity.length === 0 ? (
            <Empty title="Nothing logged yet">HQ actions against this cafe will show up here.</Empty>
          ) : (
            <div className="hq-tl">
              {activity.map((a) => {
                const { Icon, tone } = actionVisual(a.action);
                return (
                  <div key={a.id} className="hq-tl-row">
                    <div className="hq-tl-ico" data-tone={tone === "neutral" ? undefined : tone}>
                      <Icon />
                    </div>
                    <div className="hq-tl-body">
                      {a.summary}
                      <div className="meta mono">
                        {a.actorEmail} · {dateTime(a.at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
