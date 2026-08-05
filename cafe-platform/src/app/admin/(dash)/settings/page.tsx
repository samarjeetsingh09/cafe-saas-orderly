import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPlatformUser } from "@/lib/session";
import { canHq } from "@/lib/hq-permissions";
import { getPlatformSettings } from "@/lib/hq-settings";
import { PageHeader, Card } from "@/components/admin/ui";
import { PlatformUsersPanel } from "@/components/admin/PlatformUsersPanel";
import { PlansPanel } from "@/components/admin/PlansPanel";
import { DefaultsPanel } from "@/components/admin/DefaultsPanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getPlatformUser();
  // 404 rather than a "not permitted" page: the rail already hides this link
  // for ops/support, so anyone arriving here typed the URL, and there is no
  // reason to confirm the screen exists for them.
  if (!user || !canHq(user.role, "managePlatformUsers")) notFound();

  const [users, plans, defaults] = await Promise.all([
    prisma.platformUser.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: true } } } }),
    getPlatformSettings(),
  ]);

  return (
    <>
      <PageHeader title="Settings" subtitle="HQ accounts, plans and the defaults every new cafe starts from" />

      <Card title={`HQ users (${users.length})`} sub="Who can sign in to this console" flush>
        <PlatformUsersPanel
          currentUserId={user.id}
          users={users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            active: u.active,
            lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </Card>

      <div style={{ marginTop: 14 }}>
        <Card title={`Plans (${plans.length})`} sub="Changing a price re-bills every cafe on the plan without an override" flush>
          <PlansPanel
            plans={plans.map((p) => ({
              id: p.id,
              name: p.name,
              pricePaise: p.pricePaise,
              maxTables: p.maxTables,
              features: Array.isArray(p.features) ? (p.features as string[]) : [],
              sortOrder: p.sortOrder,
              subscriberCount: p._count.subscriptions,
            }))}
          />
        </Card>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card title="Platform defaults" sub="Used by the provisioning wizard and the support SLA clock">
          <DefaultsPanel defaults={defaults} plans={plans.map((p) => ({ id: p.id, name: p.name }))} />
        </Card>
      </div>
    </>
  );
}
