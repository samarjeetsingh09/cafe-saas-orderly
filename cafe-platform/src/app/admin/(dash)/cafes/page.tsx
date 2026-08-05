import Link from "next/link";
import { listCafes, type CafeSort } from "@/lib/hq-cafes";
import { prisma } from "@/lib/db";
import { getPlatformUser } from "@/lib/session";
import { canHq } from "@/lib/hq-permissions";
import { CafesFilterBar } from "@/components/admin/CafesFilterBar";
import { CafeActions } from "@/components/admin/CafeActions";
import { PageHeader, Card, TableWrap, Badge, Empty, STATUS_TONE, shortDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Tenant status → the leading-edge rail colour (hq.css `tr[data-rail]`). */
const STATUS_RAIL: Record<string, string | undefined> = {
  active: "ok",
  trial: "info",
  paused: "warn",
  cancelled: undefined,
};

const COLUMNS: { key: CafeSort; label: string; right?: boolean }[] = [
  { key: "name", label: "Cafe" },
  { key: "plan", label: "Plan" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
  { key: "orders", label: "Orders today", right: true },
];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sort = (["created", "name", "orders", "status", "plan"] as const).includes(sp.sort as CafeSort) ? (sp.sort as CafeSort) : "created";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const [result, plans, user] = await Promise.all([
    listCafes({
      status: sp.status || undefined,
      planId: sp.planId || undefined,
      noOrdersToday: sp.noOrders === "1",
      search: sp.search || undefined,
      sort,
      dir,
      page,
    }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    getPlatformUser(),
  ]);
  const role = user!.role;

  /** Preserve every other query param when toggling a sort or turning a page. */
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    return `/admin/cafes?${params.toString()}`;
  };

  const from = result.total === 0 ? 0 : (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);

  return (
    <>
      <PageHeader title="Cafes" subtitle={`${result.total} cafe${result.total === 1 ? "" : "s"} match the current filters`}>
        {canHq(role, "provisionCafe") && (
          <Link href="/admin/cafes/new" className="hq-btn" data-variant="accent">
            + Provision cafe
          </Link>
        )}
      </PageHeader>

      <CafesFilterBar plans={plans} />

      <Card flush>
        {result.rows.length === 0 ? (
          <Empty
            title="No cafes match these filters"
            action={
              <Link href="/admin/cafes" className="hq-btn">
                Clear filters
              </Link>
            }
          >
            Try widening the status or plan filter.
          </Empty>
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={`sortable${c.right ? " r" : ""}`} aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                      <Link href={href({ sort: c.key, dir: sort === c.key && dir === "asc" ? "desc" : "asc", page: undefined })} style={{ color: "inherit", textDecoration: "none" }}>
                        {c.label}
                        {sort === c.key && <span className="arrow">{dir === "asc" ? "↑" : "↓"}</span>}
                      </Link>
                    </th>
                  ))}
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((c) => (
                  <tr key={c.id} data-rail={STATUS_RAIL[c.status]}>
                    <td>
                      <Link href={`/admin/cafes/${c.id}`} className="name">
                        {c.name}
                      </Link>
                      <span className="sub mono">{c.slug}</span>
                    </td>
                    <td>{c.planName ?? "—"}</td>
                    <td>
                      <Badge tone={STATUS_TONE[c.status] ?? "neutral"} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="mono" style={{ color: "var(--hq-text-2)" }}>
                      {shortDate(c.createdAt)}
                    </td>
                    <td className="r num" style={{ fontWeight: c.ordersToday === 0 ? 400 : 600, color: c.ordersToday === 0 ? "var(--hq-text-3)" : undefined }}>
                      {c.ordersToday}
                    </td>
                    <td>
                      {c.ownerName ?? <span style={{ color: "var(--hq-text-3)" }}>no owner</span>}
                      {c.ownerEmail && <span className="sub">{c.ownerEmail}</span>}
                    </td>
                    <td>
                      <CafeActions
                        tenantId={c.id}
                        tenantSlug={c.slug}
                        tenantName={c.name}
                        status={c.status}
                        canBilling={canHq(role, "suspendOrDeleteCafe")}
                        canImpersonate={canHq(role, "impersonate")}
                        canEdit={canHq(role, "editBranding")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            {result.pageCount > 1 && (
              <div className="hq-pager">
                <span className="mono">
                  {from}–{to} of {result.total}
                </span>
                <div className="pages">
                  {result.page > 1 && (
                    <Link href={href({ page: result.page - 1 })} className="hq-btn" data-size="sm">
                      Previous
                    </Link>
                  )}
                  <span className="mono" style={{ padding: "0 6px" }}>
                    {result.page} / {result.pageCount}
                  </span>
                  {result.page < result.pageCount && (
                    <Link href={href({ page: result.page + 1 })} className="hq-btn" data-size="sm">
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
